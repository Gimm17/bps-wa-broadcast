#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PostgreSQL Database Backup Script for BPS Sulteng WhatsApp Broadcast Platform
#
# Creates a compressed custom-format pg_dump archive and enforces 30-day retention.
# Can be run daily via cron or hosting panel scheduled tasks.
# ==============================================================================

# 1. Configuration & Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Load .env if present
if [ -f "$ROOT_DIR/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ROOT_DIR/.env" | xargs -0 -n 1 2>/dev/null || grep -v '^#' "$ROOT_DIR/.env" | xargs -n 1)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is required."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/bps_whatsapp_backup_${TIMESTAMP}.dump"

echo "===================================================="
echo " Starting Database Backup: $(date)"
echo " Destination: $BACKUP_FILE"
echo "===================================================="

CLEAN_DATABASE_URL="${DATABASE_URL%%\?*}"

# 2. Run pg_dump in Custom Compressed Format
pg_dump \
  --dbname="$CLEAN_DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="$BACKUP_FILE"

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✓ Backup completed successfully! Size: $FILE_SIZE"

# 3. Retention Policy: Prune backups older than RETENTION_DAYS
echo "Applying retention policy (pruning backups older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -type f -name "bps_whatsapp_backup_*.dump" -mtime +"$RETENTION_DAYS" -exec rm -f {} \;
echo "✓ Retention policy applied."

echo "===================================================="
echo " Backup finished cleanly."
echo "===================================================="
