# Disaster Recovery Guide — MarketX Backend

## Overview

This document covers backup strategy, recovery procedures, and RTO/RPO targets for the MarketX platform.

| Metric | Target |
|--------|--------|
| RTO (Recovery Time Objective) | < 1 hour |
| RPO (Recovery Point Objective) | < 24 hours (daily backups) |
| Backup Frequency | Daily at 02:00 UTC |
| Backup Retention | 30 days (S3 lifecycle policy) |

---

## Backup Strategy

Backups run automatically via `BackupService` (NestJS `@Cron`). They use `pg_dump` in **custom format** (`-Fc`), which is compressed and supports selective table restoration.

Files are stored in S3 with `AES256` server-side encryption and `STANDARD_IA` storage class.

### S3 Lifecycle Policy (set manually or via Terraform)
```json
{
  "Rules": [{
    "Status": "Enabled",
    "Expiration": { "Days": 30 },
    "Filter": { "Prefix": "postgres-backups/" }
  }]
}
```

---

## Environment Variables Required
```env
DATABASE_HOST=
DATABASE_PORT=5432
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_NAME=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BACKUP_BUCKET=marketx-backups
AWS_S3_BACKUP_PREFIX=postgres-backups
```

---

## Recovery Procedures

### Scenario 1: Accidental data deletion

1. Identify the most recent clean backup:
```bash
   aws s3 ls s3://marketx-backups/postgres-backups/ --recursive | sort -r | head -10
```
2. Restore to a **staging database** first to verify data:
```bash
   DATABASE_NAME=marketx_verify ./scripts/backup/restore.sh postgres-backups/backup-scheduled-YYYY-MM-DDT02-00-00Z.dump marketx_verify
```
3. Inspect data, then promote to production if correct:
```bash
   ./scripts/backup/restore.sh postgres-backups/backup-scheduled-YYYY-MM-DDT02-00-00Z.dump marketx_production
```

### Scenario 2: Full server loss

1. Provision new database server (RDS or VM).
2. Set environment variables.
3. Run restore script targeting the new DB:
```bash
   ./scripts/backup/restore.sh <s3-key> <new-db-name>
```
4. Update `DATABASE_HOST` in app config and redeploy.

### Scenario 3: Manual backup before risky migration

Trigger an ad-hoc backup via API:
```bash
curl -X POST https://api.marketx.com/admin/backups/trigger \
  -H "Authorization: Bearer <admin-token>"
```

Or via script:
```bash
TAG=pre-migration ./scripts/backup/pg-backup.sh pre-migration
```

---

## Monitoring & Alerts

Backup failures are logged as structured errors with `alert: BACKUP_FAILURE`. Wire these into your alerting stack:

- **CloudWatch Logs**: filter for `BACKUP_FAILURE` and trigger SNS alarm
- **Slack/PagerDuty**: consume from `sendAlertOnFailure()` in `BackupService`
- **Health endpoint**: extend `/health` to report last backup timestamp

---

## Testing the Restore Process

Run monthly (or before major releases):
```bash
# 1. Pick latest backup
LATEST=$(aws s3 ls s3://marketx-backups/postgres-backups/ | sort -r | head -1 | awk '{print $4}')

# 2. Restore to test DB
./scripts/backup/restore.sh "postgres-backups/${LATEST}" marketx_drtest

# 3. Smoke test
psql -U $DATABASE_USER -d marketx_drtest -c "SELECT COUNT(*) FROM users;"

# 4. Cleanup
psql -U $DATABASE_USER -d postgres -c "DROP DATABASE marketx_drtest;"
```

Document results in a DR test log with: date, backup used, restore duration, row counts verified.