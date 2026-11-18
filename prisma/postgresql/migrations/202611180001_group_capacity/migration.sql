-- Group sessions (classes, courses): a service may have several places per time slot.
-- Occupancy gains a place number; one-to-one services always use place 0, so their double-booking
-- protection is unchanged. Idempotent because the runner re-applies every step on upgrade.
ALTER TABLE "EventType" ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 1;
DO $c$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='EventType_capacity_check') THEN
    ALTER TABLE "EventType" ADD CONSTRAINT "EventType_capacity_check" CHECK ("capacity" BETWEEN 1 AND 500);
  END IF;
END $c$;
ALTER TABLE "BookingOccupancy" ADD COLUMN IF NOT EXISTS "seat" INTEGER NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS "BookingOccupancy_workspaceId_hostId_minuteStart_key";
CREATE UNIQUE INDEX IF NOT EXISTS "BookingOccupancy_workspaceId_hostId_minuteStart_seat_key" ON "BookingOccupancy"("workspaceId", "hostId", "minuteStart", "seat");

-- Busy intervals with the service and start time, so a group session can tell its own places apart
-- from other appointments. Times and ids only, never client data; bound to the signed workspace.
CREATE OR REPLACE FUNCTION tempocove_host_busy_detail(p_workspace text, p_host text, p_from timestamp, p_to timestamp, p_exclude text)
RETURNS TABLE(busy_start timestamp, busy_end timestamp, event_type_id text, start_at timestamp, end_at timestamp)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
  IF p_workspace IS NULL OR p_workspace IS DISTINCT FROM current_setting('tempocove.workspace_id', true) THEN RETURN; END IF;
  RETURN QUERY SELECT b."startAt" - make_interval(mins => b."bufferBeforeMinutes"), b."endAt" + make_interval(mins => b."bufferAfterMinutes"), b."eventTypeId", b."startAt", b."endAt"
    FROM "Booking" b
    WHERE b."workspaceId"=p_workspace AND b."hostId"=p_host AND b.status IN ('CONFIRMED','PENDING_PAYMENT')
      AND b."startAt" < p_to AND b."endAt" > p_from AND (p_exclude IS NULL OR b.id<>p_exclude);
END $fn$;
REVOKE ALL ON FUNCTION tempocove_host_busy_detail(text,text,timestamp,timestamp,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tempocove_host_busy_detail(text,text,timestamp,timestamp,text) TO tempocove_app;

-- Places already taken in one group session (same service, same start).
CREATE OR REPLACE FUNCTION tempocove_taken_seats(p_workspace text, p_event_type text, p_start timestamp, p_exclude text)
RETURNS SETOF integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
  IF p_workspace IS NULL OR p_workspace IS DISTINCT FROM current_setting('tempocove.workspace_id', true) THEN RETURN; END IF;
  RETURN QUERY SELECT DISTINCT o.seat FROM "BookingOccupancy" o JOIN "Booking" b ON b.id=o."bookingId"
    WHERE b."workspaceId"=p_workspace AND b."eventTypeId"=p_event_type AND b."startAt"=p_start
      AND b.status IN ('CONFIRMED','PENDING_PAYMENT') AND (p_exclude IS NULL OR b.id<>p_exclude);
END $fn$;
REVOKE ALL ON FUNCTION tempocove_taken_seats(text,text,timestamp,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tempocove_taken_seats(text,text,timestamp,text) TO tempocove_app;
