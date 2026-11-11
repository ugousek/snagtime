#!/bin/sh
set -eu

if [ -n "${DATABASE_URL_FILE:-}" ]; then
  [ -f "$DATABASE_URL_FILE" ] || { echo '{"status":"error","code":"DATABASE_URL_FILE_MISSING"}' >&2; exit 78; }
  DATABASE_URL=$(tr -d '\r\n' < "$DATABASE_URL_FILE")
fi

case "${DATABASE_URL:-}" in
  postgres://*|postgresql://*) ;;
  *) echo '{"status":"error","code":"POSTGRES_URL_REQUIRED"}' >&2; exit 78 ;;
esac

case "$DATABASE_URL" in
  *sslmode=verify-full*sslrootcert=*) ;;
  *) echo '{"status":"error","code":"VERIFIED_TLS_REQUIRED"}' >&2; exit 78 ;;
esac

# Apply every migration directory in order. The later steps are written idempotently (IF NOT EXISTS,
# CREATE OR REPLACE, DROP ... IF EXISTS), so re-running them on an upgraded database is safe.
# The baseline creates tables without IF NOT EXISTS and is therefore skipped once the schema exists.
schema_exists=$(psql "$DATABASE_URL" -X -tAc "SELECT to_regclass('public.\"User\"') IS NOT NULL")
for step in $(ls -1 /migrations/steps | sort); do
  file="/migrations/steps/$step/migration.sql"
  [ -f "$file" ] || continue
  case "$step" in *_production_baseline) [ "$schema_exists" = "t" ] && continue ;; esac
  psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$file"
  echo "{\"status\":\"applied\",\"migration\":\"$step\"}"
done
