#!/usr/bin/env bash
# docker compose wrapper for the self-hosted deployment, e.g. ./deploy/dc.sh ps | logs -f web | down
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_ID="$(git -C "$DEPLOY_DIR/.." rev-parse HEAD)" exec docker compose --project-directory "$DEPLOY_DIR" --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/compose.yml" "$@"
