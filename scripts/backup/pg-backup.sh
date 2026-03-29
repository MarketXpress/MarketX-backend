#!/usr/bin/env bash
# Manual/CI backup script — wraps pg_dump and uploads to S3.
# Usage: ./scripts/backup/pg-backup.sh [tag]
set -euo pipefail

TAG="${1:-manual}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
FILENAME="backup-${TAG}-${TIMESTAMP}.dump"
TMP_DIR="/tmp/pg-backups"
LOCAL_PATH="${TMP_DIR}/${FILENAME}"
S3_BUCKET="${AWS_S3_BACKUP_BUCKET}"
S3_PREFIX="${AWS_S3_BACKUP_PREFIX:-postgres-backups}"
S3_KEY="${S3_PREFIX}/${FILENAME}"

mkdir -p "${TMP_DIR}"

echo "[$(date -u)] Starting backup: ${FILENAME}"

export PGPASSWORD="${DATABASE_PASSWORD}"
pg_dump \
  -h "${DATABASE_HOST:-localhost}" \
  -p "${DATABASE_PORT:-5432}" \
  -U "${DATABASE_USER}" \
  -F c \
  -f "${LOCAL_PATH}" \
  "${DATABASE_NAME}"

echo "[$(date -u)] Dump complete. Uploading to s3://${S3_BUCKET}/${S3_KEY}"

aws s3 cp "${LOCAL_PATH}" "s3://${S3_BUCKET}/${S3_KEY}" \
  --sse AES256 \
  --storage-class STANDARD_IA

rm -f "${LOCAL_PATH}"
echo "[$(date -u)] Backup complete: ${S3_KEY}"