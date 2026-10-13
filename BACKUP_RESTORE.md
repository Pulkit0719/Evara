# Evara Backup & Disaster Recovery Guide

This guide details the backup, restoration, and disaster recovery procedures for Evara.

## 1. Database Backup

### Automated / Scheduled Backup via `mysqldump`

Run a full database dump with single-transaction consistency:

```bash
mysqldump \
  --single-transaction \
  --quick \
  --triggers \
  --routines \
  -u <db_user> \
  -p<db_password> \
  -h <db_host> \
  <database_name> > evara_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Docker Database Backup

If running with Docker Compose:

```bash
docker exec evara_mysql mysqldump \
  --single-transaction \
  -u evara_user \
  -pevara_password \
  evara_db > evara_db_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 2. Database Restore

To restore an existing database from backup:

```bash
mysql -u <db_user> -p<db_password> -h <db_host> <database_name> < evara_backup_YYYYMMDD_HHMMSS.sql
```

Or under Docker Compose:

```bash
docker exec -i evara_mysql mysql -u evara_user -pevara_password evara_db < evara_db_backup.sql
```

---

## 3. Storage Backup (If Object Storage is Enabled)

### Local Disk Storage (`.storage/uploads/`)
Create an archive of the local storage directory:
```bash
tar -czvf evara_storage_$(date +%Y%m%d).tar.gz .storage/uploads/
```

### S3-Compatible Storage
Use AWS CLI or MinIO Client (`mc`) to sync:
```bash
aws s3 sync s3://evara-bucket /backup/evara-s3-backup/
```

---

## 4. Migration Rollback Strategy

1. Before running any migration (`pnpm db:push`), create a backup snapshot.
2. In the event of migration issues:
   - Restore database from the pre-migration snapshot.
   - Revert application commit to previous release.
