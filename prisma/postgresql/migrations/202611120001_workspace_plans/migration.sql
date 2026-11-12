-- SaaS plans: one row per paying workspace (absent row = FREE), a platform operator role that can
-- read every workspace for the operator console, and a quota function for public booking limits.
-- Written idempotently because the migration runner re-applies every step on upgrade.
CREATE TABLE IF NOT EXISTS "WorkspacePlan" (
    "workspaceId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "validUntil" TIMESTAMP(3),
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspacePlan_pkey" PRIMARY KEY ("workspaceId"),
    CONSTRAINT "WorkspacePlan_plan_check" CHECK ("plan" IN ('FREE','START','PROFI'))
);
DO $fk$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='WorkspacePlan_workspaceId_fkey') THEN
    ALTER TABLE "WorkspacePlan" ADD CONSTRAINT "WorkspacePlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $fk$;
ALTER TABLE "WorkspacePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspacePlan" FORCE ROW LEVEL SECURITY;

-- The application may only read its own workspace's plan; it can never change it.
GRANT SELECT ON "WorkspacePlan" TO tempocove_app;
DROP POLICY IF EXISTS app_workspace_plan_read ON "WorkspacePlan";
CREATE POLICY app_workspace_plan_read ON "WorkspacePlan" FOR SELECT TO tempocove_app
USING ("workspaceId" = current_setting('tempocove.workspace_id', true));

-- Platform operator role: read-only overview of all workspaces plus plan management.
DO $roles$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tempocove_platform') THEN CREATE ROLE tempocove_platform NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tempocove_platform_login') THEN CREATE ROLE tempocove_platform_login NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS; END IF;
END $roles$;
GRANT tempocove_platform TO tempocove_platform_login;
GRANT USAGE ON SCHEMA public TO tempocove_platform;
GRANT SELECT ON "Workspace","Membership" TO tempocove_platform;
GRANT SELECT(id,email,name,"createdAt","emailVerifiedAt") ON "User" TO tempocove_platform;
GRANT SELECT(id,"workspaceId",status,"startAt","createdAt") ON "Booking" TO tempocove_platform;
GRANT SELECT(id,"workspaceId","isActive") ON "EventType" TO tempocove_platform;
GRANT SELECT,INSERT,UPDATE ON "WorkspacePlan" TO tempocove_platform;
DO $platform_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['Workspace','Membership','User','Booking','EventType'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS platform_read ON %I', table_name);
    EXECUTE format('CREATE POLICY platform_read ON %I FOR SELECT TO tempocove_platform USING (true)', table_name);
  END LOOP;
END $platform_rls$;
DROP POLICY IF EXISTS platform_plan_write ON "WorkspacePlan";
CREATE POLICY platform_plan_write ON "WorkspacePlan" FOR ALL TO tempocove_platform USING (true) WITH CHECK (true);

-- Bookings created this calendar month (UTC), excluding cancelled ones, for the workspace in the
-- current signed context only. Returns NULL for any other workspace so counts never leak.
CREATE OR REPLACE FUNCTION tempocove_workspace_month_bookings(p_workspace text) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
  IF p_workspace IS NULL OR p_workspace IS DISTINCT FROM current_setting('tempocove.workspace_id', true) THEN RETURN NULL; END IF;
  RETURN (SELECT count(*)::integer FROM "Booking" b WHERE b."workspaceId"=p_workspace AND b.status<>'CANCELLED'
    AND b."createdAt" >= date_trunc('month', timezone('UTC', clock_timestamp())));
END $fn$;
REVOKE ALL ON FUNCTION tempocove_workspace_month_bookings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tempocove_workspace_month_bookings(text) TO tempocove_app;

-- Busy intervals (times only, buffers applied, no client data) of one host, for slot generation.
-- The public booking context may not read other clients' bookings, so without this the public
-- page offered times that were already taken and the booking then failed with a conflict.
CREATE OR REPLACE FUNCTION tempocove_host_busy(p_workspace text, p_host text, p_from timestamp, p_to timestamp, p_exclude text)
RETURNS TABLE(busy_start timestamp, busy_end timestamp)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
  IF p_workspace IS NULL OR p_workspace IS DISTINCT FROM current_setting('tempocove.workspace_id', true) THEN RETURN; END IF;
  RETURN QUERY SELECT b."startAt" - make_interval(mins => b."bufferBeforeMinutes"), b."endAt" + make_interval(mins => b."bufferAfterMinutes")
    FROM "Booking" b
    WHERE b."workspaceId"=p_workspace AND b."hostId"=p_host AND b.status IN ('CONFIRMED','PENDING_PAYMENT')
      AND b."startAt" < p_to AND b."endAt" > p_from AND (p_exclude IS NULL OR b.id<>p_exclude);
END $fn$;
REVOKE ALL ON FUNCTION tempocove_host_busy(text,text,timestamp,timestamp,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tempocove_host_busy(text,text,timestamp,timestamp,text) TO tempocove_app;
