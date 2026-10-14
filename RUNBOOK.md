# Evara Production Runbook & Incident Response Guide

This runbook provides complete operational procedures for managing, maintaining, and troubleshooting **Evara** in production on **Vercel** with **TiDB Cloud Serverless (MySQL 8.0)**.

---

## 1. Quick Reference & Operational Probes

| Probe / Action | URL / Command | Expected Response |
| :--- | :--- | :--- |
| **Production Application** | `https://evara-gray.vercel.app` | Returns HTML and Vite React shell (HTTP 200) |
| **Liveness Check** | `GET https://evara-gray.vercel.app/healthz` | `{"status":"ok","timestamp":"..."}` (HTTP 200) |
| **Readiness Check** | `GET https://evara-gray.vercel.app/readyz` | `{"status":"ready","database":"connected","timestamp":"..."}` (HTTP 200) |
| **Degraded State** | `GET https://evara-gray.vercel.app/readyz` | `{"status":"error","database":"disconnected",...}` (HTTP 503) |
| **tRPC API Root** | `POST https://evara-gray.vercel.app/api/trpc/*` | Type-safe JSON response with CSRF origin validation |
| **Database Backup** | `node scripts/backup-db.cjs` | Dumps SQL + SHA-256 into `backups/` with 7-day retention |

---

## 2. Production Architecture

```text
[ Client Browser ]
       │ HTTPS / TLS 1.3
       ▼
[ Vercel Global Edge Network ]
  ├── Static Assets ──────────► dist/public (CDN Edge Caching)
  │                                ├── index.html
  │                                └── assets/*.js, assets/*.css
  │
  ├── Edge Security Headers ──► nosniff, SAMEORIGIN, strict-origin, HSTS
  │
  └── API & Health Rewrites ──► api/index.js (Node.js 22 Serverless Function)
                                       │
                                       ├── Express Middleware (Trust Proxy, CSRF Guard)
                                       ├── Health Probes (/healthz, /readyz)
                                       └── tRPC Procedures (auth, periods, tracking, reports)
                                             │
                                             │ TLS 1.3 (TLS_AES_128_GCM_SHA256)
                                             ▼
                              [ TiDB Cloud Serverless ]
                              Host: gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000
                              Database: `evara`
```

---

## 3. Incident Response Procedures

### Incident 1: Site Down (HTTP 500 / 502 / 503 / 504)
- **Detection**: Production Health Monitor fails; browser displays error page; `/healthz` fails.
- **Immediate Action**:
  1. Check Vercel Status: `https://www.vercel-status.com/`
  2. Inspect Vercel runtime logs: **Vercel Dashboard → Evara → Deployments → Functions Tab**.
  3. Verify whether error is build-time or runtime function invocation failure.
- **Rollback**:
  - In Vercel Dashboard, click **Deployments → Select Previous Healthy Deployment → Instant Rollback**.
- **Verification**:
  - Run: `curl -I https://evara-gray.vercel.app/healthz` (verify HTTP 200).
- **Follow-up**:
  - Reproduce failure locally with `pnpm build && node api/index.js` or `pnpm test`.

### Incident 2: Database Unavailable (`/readyz` returns 503)
- **Detection**: `/readyz` probe returns HTTP 503 with `"database":"disconnected"`.
- **Immediate Action**:
  1. Check TiDB Cloud Console: [https://tidbcloud.com/](https://tidbcloud.com/)
  2. Verify cluster status is **ACTIVE** (not paused or throttled).
  3. Verify DNS resolution for cluster gateway (`gateway01.ap-northeast-1.prod.aws.tidbcloud.com`).
  4. Test direct database connectivity:
     ```bash
     node -e "require('./scripts/backup-db.cjs')"
     ```
- **Rollback**:
  - Database connectivity outages are infrastructure-side. If credentials expired or were revoked, update `DATABASE_URL` in **Vercel → Project Settings → Environment Variables** and redeploy.
- **Verification**:
  - `curl -s https://evara-gray.vercel.app/readyz | grep '"database":"connected"'`
- **Follow-up**:
  - Review TiDB Cloud query logs and connection pool limits.

### Incident 3: Authentication / Login Broken
- **Detection**: Registration or login fails with HTTP 500 or users report inability to sign in.
- **Immediate Action**:
  1. Inspect Vercel function logs for `[Auth]` tag.
  2. Confirm `SESSION_SECRET` is configured in Vercel production environment variables.
  3. Check whether `sessions` table in TiDB is reachable and accessible:
     ```sql
     SELECT COUNT(*) FROM evara.sessions;
     ```
  4. Verify rate limiter is not blocking legitimate users (rate limit is 10 attempts per 15 minutes per IP).
- **Rollback**:
  - If a recent code change broke auth, roll back Vercel deployment to previous release tag.
- **Verification**:
  - Execute live auth test using synthetic test account.
- **Follow-up**:
  - Ensure password scrypt hashing and session token SHA-256 hashing functions pass all 70 local tests.

### Incident 4: Deployment Failed
- **Detection**: GitHub Actions CI fails or Vercel build log reports failure.
- **Immediate Action**:
  1. Open GitHub Actions tab or Vercel Build Logs to inspect the exact failure.
  2. Check for missing pre-bundle step or TypeScript compilation error.
  3. Verify locally:
     ```bash
     pnpm check
     pnpm test
     pnpm build
     ```
- **Rollback**:
  - Production traffic continues serving the previous active deployment until a build succeeds; Vercel never serves broken builds.
- **Verification**:
  - Fix the offending line, push to `main`, and verify build succeeds.

### Incident 5: Secrets Exposed
- **Detection**: Credential alert, unauthorized login attempt, or accidental credential commit.
- **Immediate Action**:
  1. **DATABASE_URL Rotation**:
     - Go to TiDB Cloud Console → Security → Users → Reset Password.
     - Update `DATABASE_URL` in Vercel Environment Variables.
     - Redeploy application.
  2. **SESSION_SECRET Rotation**:
     - Generate a new secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
     - Update `SESSION_SECRET` in Vercel Environment Variables.
     - Clear active sessions in TiDB: `TRUNCATE TABLE evara.sessions;` (forces re-login).
     - Redeploy application.
  3. **Git History Scrubbing** (if committed to Git):
     - Use `git-filter-repo` or BFG Repo-Cleaner to purge credential from history.
     - Force push sanitized history.
- **Verification**:
  - Confirm old credentials fail; confirm new credentials connect cleanly via `/readyz`.

### Incident 6: Data Deletion Issue (Cascade Failure)
- **Detection**: User requests account deletion, but child records remain or deletion errors out.
- **Immediate Action**:
  1. Verify foreign key constraints in TiDB schema:
     ```sql
     SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME 
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'evara' AND REFERENCED_TABLE_NAME = 'users';
     ```
  2. If a child table was created without `ON DELETE CASCADE`, apply the constraint or run manual transaction deletion:
     ```sql
     START TRANSACTION;
     DELETE FROM evara.periodLogs WHERE userId = ?;
     DELETE FROM evara.symptomLogs WHERE userId = ?;
     DELETE FROM evara.wellnessLogs WHERE userId = ?;
     DELETE FROM evara.userProfiles WHERE userId = ?;
     DELETE FROM evara.sessions WHERE userId = ?;
     DELETE FROM evara.users WHERE id = ?;
     COMMIT;
     ```
- **Verification**:
  - Verify `SELECT COUNT(*) FROM ... WHERE userId = ?` returns 0 across all tables.

### Incident 7: Backup Failure
- **Detection**: Scheduled backup script outputs error or exits with non-zero status.
- **Immediate Action**:
  1. Check disk space on backup target.
  2. Test database connection string in `.env`.
  3. Run backup manually: `node scripts/backup-db.cjs`.
  4. Verify generated `.sql` file and `.sha256` checksum.
- **Rollback**:
  - Maintain previous backup snapshot until a new healthy snapshot completes.
- **Verification**:
  - Inspect backup file size and table row counts.

---

## 4. Rollback Runbook Summary

```text
[ Operational Issue Detected ]
              │
              ├── Code / Application Failure ──► Vercel Dashboard ──► Instant Rollback (0s DNS cutover)
              │
              └── Database Corruption / Loss ──► Restore from `backups/*.sql` into temporary DB,
                                                  verify integrity, then swap to production
```
