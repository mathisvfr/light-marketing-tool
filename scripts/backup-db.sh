#!/usr/bin/env bash
# ============================================================
# Daily Supabase/Postgres backup — run via cron on VPS:
#   0 3 * * * ~/light-marketing-tool/scripts/backup-db.sh >> /var/log/backup-db.log 2>&1
#
# Requires: docker (uses pg_dump from the umami-db container), gzip
# Env: DATABASE_URL (direct Postgres connection string, NOT the REST URL)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if running outside Docker
if [ -f "$PROJECT_DIR/.env" ]; then
  # shellcheck disable=SC1091
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

# ---- Config ----
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
KEEP_COUNT="${KEEP_COUNT:-14}"
MAX_DIR_MB="${MAX_DIR_MB:-500}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/light-db-$TIMESTAMP.sql.gz"

# ---- Preflight ----
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set. Add it to .env (see .env.example)."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ---- Disk safety ----
dir_size_mb() {
  du -sm "$1" 2>/dev/null | awk '{print $1}'
}

CURRENT_MB=$(dir_size_mb "$BACKUP_DIR")
if [ "${CURRENT_MB:-0}" -ge "$MAX_DIR_MB" ]; then
  echo "[WARN] Backup directory is ${CURRENT_MB}MB (limit: ${MAX_DIR_MB}MB). Skipping backup."
  echo "[WARN] Delete old backups or increase MAX_DIR_MB."
  exit 1
fi

# ---- Dump (via Docker postgres:17-alpine for version match) ----
echo "[INFO] Starting backup to $BACKUP_FILE"
docker run --rm --network host postgres:17-alpine \
  pg_dump "$DATABASE_URL" --no-owner --no-privileges --clean --if-exists \
  | gzip > "$BACKUP_FILE"

FILE_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
echo "[OK] Backup complete: $BACKUP_FILE ($FILE_SIZE)"

# ---- Rotate: keep last N files ----
FILE_COUNT=$(find "$BACKUP_DIR" -name 'light-db-*.sql.gz' -type f | wc -l)
if [ "$FILE_COUNT" -gt "$KEEP_COUNT" ]; then
  DELETE_COUNT=$((FILE_COUNT - KEEP_COUNT))
  # shellcheck disable=SC2012
  ls -1t "$BACKUP_DIR"/light-db-*.sql.gz | tail -n "$DELETE_COUNT" | while read -r old; do
    echo "[INFO] Rotating old backup: $old"
    rm -f "$old"
  done
fi

echo "[INFO] Backups in $BACKUP_DIR: $(find "$BACKUP_DIR" -name 'light-db-*.sql.gz' -type f | wc -l) files"
