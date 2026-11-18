#!/usr/bin/env bash
# One-command self-hosted install/upgrade. Safe to re-run: existing secrets and data are kept.
# Usage (from the repository root on the server): ./deploy/setup.sh
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$DEPLOY_DIR")"
SECRETS="$DEPLOY_DIR/secrets"
cd "$DEPLOY_DIR"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31mChyba: %s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker není nainstalovaný (https://docs.docker.com/engine/install/)."
docker compose version >/dev/null 2>&1 || die "Chybí plugin docker compose."
command -v openssl >/dev/null || die "Chybí openssl."
[ -f .env ] || die "Chybí deploy/.env. Zkopíruj deploy/env.example na deploy/.env a vyplň ho."

set -a; . ./.env; set +a
[ -n "${APP_DOMAIN:-}" ] || die "V deploy/.env chybí APP_DOMAIN."

BUILD_ID="$(git -C "$REPO_DIR" rev-parse HEAD)"; export BUILD_ID
DC=(docker compose --env-file .env -f compose.yml)

rand() { openssl rand -hex "$1"; }
put() { # put NAME VALUE: write a secret file once
  [ -s "$SECRETS/$1" ] && return 0
  printf '%s' "$2" > "$SECRETS/$1"
}

say "Tajné klíče"
install -d -m 0700 "$SECRETS"
for name in postgres_owner_password auth_secret booking_capability_secret email_token_secret tenant_context_secret \
            rate_limit_hash_secret proxy_shared_secret operator_health_secret \
            db_migration_password db_app_password db_worker_password db_monitor_password db_platform_password; do
  put "$name" "$(rand 32)"
done
put token_encryption_key "$(rand 32)"
put booking_capability_keyring "{\"k1\":\"$(cat "$SECRETS/booking_capability_secret")\"}"
for name in google_client_secret stripe_secret_key stripe_webhook_secret; do [ -f "$SECRETS/$name" ] || : > "$SECRETS/$name"; done
if [ ! -s "$SECRETS/smtp_password" ]; then
  read -rsp "Heslo k SMTP účtu ${SMTP_USER:-}: " smtp; echo
  [ -n "$smtp" ] || die "SMTP heslo je povinné."
  printf '%s' "$smtp" > "$SECRETS/smtp_password"
fi
printf 'PROXY_SHARED_SECRET=%s\n' "$(cat "$SECRETS/proxy_shared_secret")" > "$SECRETS/caddy.env"

say "TLS certifikáty pro databázi"
if [ ! -s "$SECRETS/postgres_server_cert" ]; then
  tmp="$(mktemp -d)"
  openssl req -x509 -newkey rsa:3072 -nodes -days 3650 -subj "/CN=rezervace-db-ca" \
    -keyout "$tmp/ca.key" -out "$SECRETS/postgres_ca_cert" 2>/dev/null
  openssl req -newkey rsa:3072 -nodes -subj "/CN=postgres" -keyout "$SECRETS/postgres_server_key" -out "$tmp/server.csr" 2>/dev/null
  printf 'subjectAltName=DNS:postgres\nextendedKeyUsage=serverAuth\n' > "$tmp/ext"
  openssl x509 -req -in "$tmp/server.csr" -CA "$SECRETS/postgres_ca_cert" -CAkey "$tmp/ca.key" -CAcreateserial \
    -days 3650 -extfile "$tmp/ext" -out "$SECRETS/postgres_server_cert" 2>/dev/null
  rm -rf "$tmp"
fi
# Containers run as non-root users and read these through bind mounts.
chmod 0644 "$SECRETS"/*

CA=/run/secrets/postgres_ca_cert
TLS="sslmode=verify-full&sslrootcert=$CA"
RUNTIME="$TLS&connect_timeout=3&pool_timeout=20&connection_limit=20&statement_timeout=2000"
url() { printf 'postgresql://%s:%s@postgres:5432/tempocove?%s' "$1" "$(cat "$SECRETS/$2")" "$3"; }
url tempocove_app_login db_app_password "$RUNTIME" > "$SECRETS/app_database_url.new"
url tempocove_worker_login db_worker_password "$RUNTIME" > "$SECRETS/worker_database_url.new"
mv "$SECRETS/app_database_url.new" "$SECRETS/app_database_url"; mv "$SECRETS/worker_database_url.new" "$SECRETS/worker_database_url"
url tempocove_platform_login db_platform_password "$RUNTIME" > "$SECRETS/platform_database_url"
# Schema changes (ALTER TABLE, policies) need the table owner, so migrations run as the owner.
# These credentials are mounted only into the short-lived migration container, never into web/worker.
url tempocove_owner postgres_owner_password "$TLS&connect_timeout=5" > "$SECRETS/migration_database_url"
chmod 0644 "$SECRETS"/*

say "Sestavení aplikace (první běh trvá několik minut)"
if [ "${SKIP_BUILD:-0}" != "1" ]; then "${DC[@]}" --profile migration build; fi

say "Databáze"
"${DC[@]}" up -d --wait postgres
migrated="$("${DC[@]}" exec -T postgres sh -c 'PGPASSWORD="$(cat /run/secrets/postgres_owner_password)" psql -U tempocove_owner -d tempocove -tAc "SELECT to_regclass('"'"'public.\"User\"'"'"') IS NOT NULL"')"
"${DC[@]}" --profile migration run --rm migration
# Logins are (re)provisioned on every run: it is idempotent and picks up roles added by new migrations.
[ "$migrated" = "t" ] || echo "První instalace: zakládám databázové účty."
{
  "${DC[@]}" run --rm --no-deps -T \
    -v "$REPO_DIR/scripts/provision-postgres-logins.mjs:/app/scripts/provision-postgres-logins.mjs:ro" \
    -e DATABASE_URL_FILE= \
    -e DATABASE_URL="$(cat "$SECRETS/migration_database_url")" \
    -e TEMPOCOVE_MIGRATION_DB_PASSWORD="$(cat "$SECRETS/db_migration_password")" \
    -e TEMPOCOVE_APP_DB_PASSWORD="$(cat "$SECRETS/db_app_password")" \
    -e TEMPOCOVE_WORKER_DB_PASSWORD="$(cat "$SECRETS/db_worker_password")" \
    -e TEMPOCOVE_MONITOR_DB_PASSWORD="$(cat "$SECRETS/db_monitor_password")" \
    -e TEMPOCOVE_PLATFORM_DB_PASSWORD="$(cat "$SECRETS/db_platform_password")" \
    -e TENANT_CONTEXT_SECRET="$(cat "$SECRETS/tenant_context_secret")" \
    web node scripts/provision-postgres-logins.mjs
}

say "Spouštím aplikaci"
"${DC[@]}" up -d --remove-orphans web worker caddy
"${DC[@]}" up -d --wait web

say "Hotovo"
echo "Aplikace běží na https://$APP_DOMAIN (certifikát se vystaví při první návštěvě, DNS musí mířit na tento server)."
echo "Účet založíš přes https://$APP_DOMAIN/signup, ověřovací e-mail odejde přes nastavené SMTP."
echo "Stav: ./deploy/dc.sh ps    Logy: ./deploy/dc.sh logs -f web    Zastavení: ./deploy/dc.sh down"
