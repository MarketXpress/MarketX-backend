#!/usr/bin/env bash
# Restore a PostgreSQL backup from S3.
# Usage: ./scripts/backup/restore.sh <s3-key> [target-db-name]
#
# Examples:
#   ./scripts/backup/restore.sh postgres-backups/backup-scheduled-2024-01-15T02-00-00Z.dump
#   ./scripts/backup/restore.sh postgres-backups/backup-manual-2024-01-14.dump marketx_restored
set -euo pipefail

S3_KEY="${1:?Usage: restore.sh <s3-key> [target-db]}"
TARGET_DB="${2:-${DATABASE_NAME}}"
TMP_DIR="/tmp/pg-backups"
LOCAL_PATH="${TMP_DIR}/restore-$(date +%s).dump"
S3_BUCKET="${AWS_S3_BACKUP_BUCKET}"

mkdir -p "${TMP_DIR}"

echo "[$(date -u)] Downloading s3://${S3_BUCKET}/${S3_KEY}..."
aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "${LOCAL_PATH}"

echo "[$(date -u)] Restoring to database: ${TARGET_DB}"
export PGPASSWORD="${DATABASE_PASSWORD}"

# Drop existing connections and recreate DB (comment out if restoring to new DB)
psql -h "${DATABASE_HOST:-localhost}" -p "${DATABASE_PORT:-5432}" \
     -U "${DATABASE_USER}" -d postgres \
     -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${TARGET_DB}' AND pid <> pg_backend_pid();"

pg_restore \
  -h "${DATABASE_HOST:-localhost}" \
  -p "${DATABASE_PORT:-5432}" \
  -U "${DATABASE_USER}" \
  -d "${TARGET_DB}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "${LOCAL_PATH}"

rm -f "${LOCAL_PATH}"
echo "[$(date -u)] Restore complete to '${TARGET_DB}'"