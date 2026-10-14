# Evara Zero-Cost Encrypted Database Backup & Offsite Sync Guide

This document describes the zero-cost, no-credit-card backup architecture for **Evara** production. It eliminates all reliance on paid cloud object storage (such as AWS S3 or Cloudflare R2) and instead leverages client-side AES-256-GCM encryption, gzip compression, and direct export to a dedicated user-controlled local directory (`C:\Users\pulki\Evara-Backups`) that easily syncs to your existing private personal cloud drives (e.g. OneDrive, iCloud, Google Drive, or Dropbox).

---

## 1. Zero-Cost Backup Architecture

```text
[ TiDB Cloud Production Database (AWS Tokyo) ]
                      │ TLS 1.3
                      ▼
[ Local Admin Workstation / Backup Tooling ]
                      │
                      ├── 1. Schema & Data Dump (All 8 tables, parent-first order)
                      ├── 2. Gzip Compression (Level 9 max compression, ~80% reduction)
                      ├── 3. Client-Side AES-256-GCM Encryption (IV + AuthTag + Ciphertext)
                      ├── 4. SHA-256 Integrity Checksum Generation (.sha256 companion file)
                      │
                      ▼
[ Dedicated Secure Backup Storage ]
Primary: `C:\Users\pulki\Evara-Backups\`
Local Mirror: `C:\VScode\evara-project-extracted\backups\` (Git-ignored)
                      │
                      ├── Automatic 7-Day Retention Cleanup
                      ▼
[ Private Personal Cloud Sync (Optional / Recommended) ]
Sync to private OneDrive / iCloud / Google Drive (Zero Extra Cost, Zero Credit Cards)
```

---

## 2. Recovery Layers & Protection

| Layer | Target / Location | Frequency | Retention | Cost / Credit Card | Encryption |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (Continuous)** | TiDB Cloud Serverless (AWS Tokyo Multi-AZ) | Continuous PITR | 30 Days | Free Tier / No Card | AES-256 (At-Rest) |
| **Tier 2 (Primary Local)** | `C:\Users\pulki\Evara-Backups` | Daily / Scheduled | 7 Days | Free / Zero Cost | AES-256-GCM + gzip |
| **Tier 3 (Offsite OneDrive)**| `C:\Users\pulki\OneDrive\Evara-Backups` | Auto-synced on Backup | 7 Days | Free / No Card | AES-256-GCM |

### Configured Destinations
- **Primary local copy**: `C:\Users\pulki\Evara-Backups`
- **Independent offsite synchronized copy**: `C:\Users\pulki\OneDrive\Evara-Backups`
- **TiDB managed snapshots**: `ACTIVE`

---

## 3. Tooling & Usage

### 1. Generate Encrypted Backup
Run the backup script directly or via npm:
```bash
npm run db:backup
# or
node scripts/backup-encrypted.cjs
```
**What happens:**
1. Connects securely to TiDB Cloud over TLS 1.3.
2. Dumps all tables (`users`, `__drizzle_migrations`, `userProfiles`, `sessions`, `periodLogs`, `symptomLogs`, `wellnessLogs`, `reminders`).
3. Compresses the SQL payload using gzip (Level 9).
4. Encrypts client-side using `AES-256-GCM` using `BACKUP_ENCRYPTION_KEY` (or `SESSION_SECRET`).
5. Generates SHA-256 integrity checksum (`.sha256`).
6. Saves the artifact to `C:\Users\pulki\Evara-Backups\evara-prod-<timestamp>.sql.gz.enc`.
7. Saves a local mirror copy to `backups/`.
8. Purges backups older than 7 days.

### 2. Verify / Restore Encrypted Backup
To verify the integrity and perform a restore rehearsal:
```bash
# Test restore into a temporary database and drop it afterwards
npm run db:restore -- --drop-after
# or
node scripts/restore-encrypted.cjs --drop-after
```
**To restore into a permanent target database:**
```bash
node scripts/restore-encrypted.cjs --file="C:\Users\pulki\Evara-Backups\evara-prod-YYYY-MM-DD.sql.gz.enc" --target-db=evara_restored
```

---

## 4. Active Microsoft OneDrive Offsite Sync

To achieve durable offsite protection without paying for cloud storage or entering a credit card, Microsoft OneDrive is configured as the offsite synchronized copy destination:

1. **Dedicated Offsite Target**:
   - Primary: `C:\Users\pulki\Evara-Backups`
   - Offsite OneDrive: `C:\Users\pulki\OneDrive\Evara-Backups`
   - Both locations exist outside the Git repository.

2. **Automatic Verification**:
   - Only `.enc` and `.sha256` files are synced (plaintext `.sql` and unencrypted `.sql.gz` are strictly excluded).
   - After file transfer, the script automatically verifies destination existence, exact byte size, and SHA-256 integrity hash match.
   - 7-day retention is applied, with a hard guarantee that the most recent valid backup is never deleted.

3. **Privacy & Cryptographic Security**:
   - Backups are encrypted client-side using `AES-256-GCM` prior to reaching the sync directory.
   - Microsoft OneDrive only ever stores encrypted binary payloads, meaning zero plaintext health or authentication data is accessible by the cloud provider.

---

## 5. Security & Privacy Rules

- **Zero Secrets Committed**: `.env`, passwords, and `BACKUP_ENCRYPTION_KEY` are never committed to Git.
- **Strictly Ignored**: `backups/`, `*.sql`, `*.sql.gz`, `*.sql.gz.enc`, and `*.sha256` are listed in `.gitignore`.
- **Zero GitHub Artifact Storage**: No sensitive health data or database dumps are uploaded to public GitHub storage.
- **Zero Credit Card Required**: No AWS, Cloudflare R2, or any billing service needed.
