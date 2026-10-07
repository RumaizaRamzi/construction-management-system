#!/usr/bin/env bash
# Example MySQL backup for BuildTrack (Linux/macOS).
# Does NOT hardcode credentials. Export env vars before running.
# Test restores only against a non-production database.
#
#   export BT_DB_HOST=...
#   export BT_DB_PORT=3306
#   export BT_DB_NAME=...
#   export BT_DB_USER=...
#   export BT_DB_PASSWORD=...
#   ./scripts/backup-database.example.sh

set -euo pipefail

HOST="${BT_DB_HOST:?BT_DB_HOST required}"
PORT="${BT_DB_PORT:-3306}"
NAME="${BT_DB_NAME:?BT_DB_NAME required}"
USER="${BT_DB_USER:?BT_DB_USER required}"
PASS="${BT_DB_PASSWORD:-}"

OUT_DIR="${BT_BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_DIR}/buildtrack-${STAMP}.sql"

export MYSQL_PWD="$PASS"
mysqldump -h "$HOST" -P "$PORT" -u "$USER" --single-transaction --routines --triggers "$NAME" > "$OUT_FILE"
unset MYSQL_PWD

echo "Backup written: ${OUT_FILE}"
