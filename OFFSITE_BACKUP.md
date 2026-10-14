# Evara Secure Encrypted Offsite Database Backup Guide

This document describes the architecture, client-side encryption, private Cloudflare R2 storage, automated daily scheduling, and restore procedures for **Evara** production backups.

---

## 1. Offsite Backup Architecture

```text
[ TiDB Cloud Production Database (AWS Tokyo) ]
                      │ TLS 1.3
                      ▼
        [ GitHub Actions Scheduled Runner ]
                      │
                      ├── 1. Schema & Data Dump (All 8 tables, parent-first order)
                      ├── 2. Gzip Compression (Level 9 max compression, ~80% reduction)
                      ├── 3. Client-Side AES-256-GCM Encryption
                      │      (12-byte random IV, 16-byte authenticated tag)
                      ├── 4. SHA-256 Integrity Checksum Generation
                      │
                      ▼ HTTPS (S3 API)
         [ Cloudflare R2 Private Bucket ]
         Bucket: `evara-backups` (PRIVATE, zero public access)
         Path: `database/daily/evara-prod-YYYY-MM-DDTHH-mm-ssZ.sql.gz.enc`
                      │
                      └── Automatic 7-Day Retention Cleanup
```

---

## 2. Multi-Layer Recovery Architecture

Evara enforces a **three-tier redundancy model**:

| Layer | Provider / Target | Frequency | Retention | Encryption |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (Continuous)** | TiDB Cloud Managed Snapshots (Multi-AZ AWS Tokyo) | Continuous Point-in-Time | 30 Days | AES-256 (At Rest) |
| **Tier 2 (Offsite Durable)** | Private Cloudflare R2 Object Storage | Daily (02:00 UTC) | 7 Days | AES-256-GCM (Client-Side) + R2 Server-Side |
| **Tier 3 (Local Safe Copy)** | Local Administrator Workstation (`backups/*.sql.gz.enc`) | On-Demand Scripted | 7 Days | AES-256-GCM (Client-Side) |

---

## 3. GitHub Actions Secrets Configuration

To enable automated daily uploads to your private Cloudflare R2 bucket, configure these secrets in **GitHub → Settings → Secrets and variables → Actions**:

| Secret Name | Description | Example / Source |
| :--- | :--- | :--- |
| `DATABASE_URL` | Production TiDB Cloud connection string | Copy from local `.env` |
| `BACKUP_ENCRYPTION_KEY` | 32-byte secret key used for AES-256-GCM encryption | Copy `SESSION_SECRET` from `.env` or generate fresh 32-byte key |
| `R2_ACCOUNT_ID` | Cloudflare account identifier | Found in Cloudflare Dashboard → R2 |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API token Access Key ID | Generated in Cloudflare Dashboard → R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API token Secret Access Key | Generated in Cloudflare Dashboard → R2 → Manage R2 API Tokens |
| `R2_BUCKET` | R2 bucket name | `evara-backups` |

---

## 4. Manual Script Execution

### Create Encrypted Backup Locally & Upload to R2:
```bash
node scripts/backup-r2.cjs
```
- Dumps database to `.sql`
- Compresses to `.sql.gz`
- Encrypts to `.sql.gz.enc` using `BACKUP_ENCRYPTION_KEY`
- Generates `.sha256` checksum file
- Uploads to `s3://evara-backups/database/daily/` (if R2 credentials present)
- Saves local copy to `backups/` (git-ignored)

### Restore / Rehearsal from Encrypted Backup:
```bash
# Rehearse restore into temporary database and drop afterwards
node scripts/restore-r2.cjs --drop-after

# Restore specific backup file into target database
node scripts/restore-r2.cjs --file=backups/evara-prod-YYYY-MM-DD.sql.gz.enc --target-db=evara_restored

# Restore directly from Cloudflare R2
node scripts/restore-r2.cjs --key=database/daily/evara-prod-YYYY-MM-DD.sql.gz.enc --target-db=evara_restored
```

---

## 5. Security & Privacy Guarantees

1. **Client-Side Encryption**: Backups are encrypted before leaving the runner using authenticated `AES-256-GCM`. Even Cloudflare cannot read the health contents.
2. **Strictly Private Bucket**: The R2 bucket has public access permanently disabled.
3. **Zero GitHub Artifact Storage**: The backup workflow explicitly verifies that temporary dump files are purged from the runner disk and never stored as GitHub Actions build artifacts or releases.
4. **Git Ignored**: The local `backups/` directory, `*.sql`, `*.sql.gz`, and `*.sql.gz.enc` are permanently excluded via `.gitignore`.
