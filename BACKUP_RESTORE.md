# Evara Backup & Disaster Recovery Guide

This guide details the automated backup, restoration, retention, and disaster recovery procedures for **Evara** in production.

---

## 1. Automated Production Backup

### Primary Encrypted Backup Tool: `scripts/backup-encrypted.cjs`

Evara provides a zero-cost, AES-256-GCM encrypted backup workflow that stores backups in a dedicated user-controlled folder outside the Git repository:

```bash
# Run encrypted backup (copies to C:\Users\pulki\Evara-Backups and backups/)
npm run db:backup
# or
node scripts/backup-encrypted.cjs
```

- **Primary Destination**: `C:\Users\pulki\Evara-Backups\evara-prod-<timestamp>.sql.gz.enc`
- **Integrity File**: `*.sql.gz.enc.sha256`
- **Security**: Authenticated `AES-256-GCM` client-side encryption + `gzip` compression (Level 9).
- **Retention**: Automatic 7-day retention cleanup.

### Rehearsal & Restore Tool: `scripts/restore-encrypted.cjs`

```bash
# Verify integrity and run rehearsal restore into temporary database:
npm run db:restore -- --drop-after
```

### Unencrypted Raw SQL Tool: `scripts/backup-db.cjs`

For quick local SQL inspections:

```bash
# Run raw SQL backup using connection string from .env
node scripts/backup-db.cjs
```

- **Output Location**: `backups/evara-backup-<timestamp>.sql` (git-ignored)
- **Integrity File**: `backups/evara-backup-<timestamp>.sql.sha256`
- **Included Tables**: `users`, `sessions`, `userProfiles`, `periodLogs`, `symptomLogs`, `wellnessLogs`, `reminders`, `__drizzle_migrations`

### TiDB Cloud Managed Backups

In addition to scripted SQL backups, TiDB Cloud Serverless provides automatic continuous snapshots:
1. Log in to [https://tidbcloud.com](https://tidbcloud.com).
2. Select your cluster → **Backups**.
3. Point-in-time recovery (PITR) is automatically retained.

---

## 2. Retention Policy & Targets

| Tier | Frequency | Retention Window | Storage Target |
| :--- | :--- | :--- | :--- |
| **Daily Backups** | Every 24 hours | Retain 7 days | Encrypted offsite volume / local safe storage |
| **Weekly Backups** | Every Sunday | Retain 4 weeks | Encrypted cold archive |
| **Monthly Backups** | 1st of month | Retain 3 months | Encrypted cold archive |

- **RPO (Recovery Point Objective)**: < 24 hours (or point-in-time via TiDB Cloud).
- **RTO (Recovery Time Objective)**: < 15 minutes to spin up clean schema and replay data.

---

## 3. Monthly Restore Rehearsal Policy

Backups that are never tested cannot be trusted. Evara enforces a **monthly restore rehearsal**:

### Step-by-Step Rehearsal Procedure

1. **Verify Backup Checksum**:
   ```bash
   certutil -hashfile backups/evara-backup-YYYY-MM-DD.sql SHA256
   # Compare output with backups/evara-backup-YYYY-MM-DD.sql.sha256
   ```

2. **Provision Temporary Rehearsal Database**:
   ```sql
   CREATE DATABASE evara_restore_rehearsal;
   ```

3. **Replay SQL Backup into Rehearsal Database**:
   ```bash
   mysql -u <user> -p<pass> -h <host> -P 4000 --ssl-mode=REQUIRED evara_restore_rehearsal < backups/evara-backup-YYYY-MM-DD.sql
   ```

4. **Verify Integrity Checks**:
   - Verify all 8 tables are present.
   - Verify `__drizzle_migrations` contains all applied migrations (`0000_...` to `0003_...`).
   - Run `SELECT COUNT(*) FROM evara_restore_rehearsal.users`.
   - Verify foreign key constraints are intact.

5. **Clean Up Temporary Database**:
   ```sql
   DROP DATABASE evara_restore_rehearsal;
   ```

6. **Log Rehearsal Outcome**: Record timestamp, verified backup SHA-256, and tester signature in operational audit logs.

---

## 4. Disaster Recovery Scenarios

### Scenario A: Accidental Data Deletion / Corruption
1. Freeze application writes by setting deployment to maintenance mode if needed.
2. Restore the latest uncorrupted backup into a staging database.
3. Extract and patch the affected rows, or replay the full snapshot to the `evara` database.
4. Verify `/readyz` returns HTTP 200 with `"database":"connected"`.

### Scenario B: Cloud Provider Outage (TiDB or Vercel Down)
1. **Database Failover**: TiDB Cloud serverless clusters feature multi-AZ redundancy within the Tokyo AWS region. In case of provider region failure, restore the SQL dump into an alternative MySQL 8.0 cluster (e.g. AWS RDS, PlanetScale, or Docker MySQL).
2. **Hosting Failover**: Vercel serves traffic from edge CDN. If Vercel functions suffer an outage, the standalone Docker container (`docker compose up -d`) or VPS Node runner (`node dist/index.js`) can take over traffic immediately.
