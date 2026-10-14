# Evara Real-User Launch Checklist

This checklist documents the operational, security, architectural, and product readiness criteria required before opening **Evara** to real-world users.

---

## 1. Code & Deployment Readiness

- [x] **Repository Independence**: 0 dependencies on Manus, Forge, or proprietary vendor runtimes.
- [x] **Production Hosting**: Active on Vercel Node.js 22 serverless runtime ([`https://evara-gray.vercel.app`](https://evara-gray.vercel.app)).
- [x] **CI Pipeline**: GitHub Actions workflow verifies typecheck (`tsc --noEmit`), unit/security tests (70/70 passing), and production build.
- [x] **Pre-bundled Serverless Handler**: `api/index.js` bundled with all path aliases (`@shared/*`) resolved.
- [x] **Release Tagged**: Production commit tagged with annotated Git release tag.
- [x] **Working Tree Clean**: Zero uncommitted files or dirty states.

---

## 2. Security & Data Protection Readiness

- [x] **HTTPS Everywhere**: TLS 1.3 enforced by Vercel global edge network with automatic certificate renewal.
- [x] **Edge Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [x] **Authentication Security**:
  - Passwords hashed using `scrypt` with unique 16-byte random salts.
  - Session tokens hashed with SHA-256 before database storage.
  - Session persistence fails closed (no cookie emitted if DB persistence fails).
  - Rate limiting on authentication endpoints (max 10 attempts per 15 minutes per IP).
- [x] **Cookie Security**:
  - `HttpOnly: true` (inaccessible to client JavaScript).
  - `Secure: true` (transmitted only over HTTPS).
  - `SameSite: Lax` (prevents cross-site request forgery).
  - `Path: /` with 30-day revocation expiry.
- [x] **CSRF / Origin Guard**: All state-changing API endpoints (`POST`, `PUT`, `DELETE`, `PATCH`) validate origin host.
- [x] **Cross-User Data Isolation**: Every database read/write/delete query is filtered on `ctx.user.id`. Verified live.
- [x] **Public Legacy Account Claiming Retired**: Blocked with HTTP 403; only verified admin procedure supported.
- [x] **Zero Secret Leakage**: Zero passwords, tokens, or raw database connection strings committed to Git or exposed in client responses.

---

## 3. Database & Reliability Readiness

- [x] **Managed Cloud Database**: TiDB Cloud Serverless MySQL 8.0 cluster in Tokyo AWS region.
- [x] **Encrypted in Transit**: TLS 1.3 active (`TLS_AES_128_GCM_SHA256`).
- [x] **Additive Drizzle Migrations**: Migrations `0000` through `0003` reconciled and applied.
- [x] **7 Core Application Tables**: `users`, `sessions`, `userProfiles`, `periodLogs`, `symptomLogs`, `wellnessLogs`, `reminders`.
- [x] **Cascade Deletion Verified**: Foreign key cascade deletion verified live; deleting a user purges all child records with 0 orphans.
- [x] **Conservative Indexing**: Indexes on `userId`, `date`, `expiresAt`, and compound unique constraints prevent duplicate records.
- [x] **Automated Backup Strategy**: `scripts/backup-db.cjs` dumps SQL with SHA-256 checksum and 7-day retention.
- [x] **Restore Rehearsal Passed**: Database restore tested into isolated rehearsal database.

---

## 4. Product Functionality Readiness

- [x] **User Registration**: Tested live. Creates user account and issues revocable session cookie.
- [x] **User Login / Logout**: Tested live. Authenticates with scrypt and revokes session on logout.
- [x] **Cycle Tracking**: Log periods, track flow intensity, record cycle history, and calculate average cycle lengths.
- [x] **Interactive Calendar**: Monthly cycle overview with recorded periods, symptoms, and wellness markers.
- [x] **Symptom & Wellness Logs**: Daily mood, energy, sleep hours, water intake, activity, and stress tracking.
- [x] **Doctor-Ready Summaries**: Printable summaries and export health records in clean JSON format.
- [x] **Direct SPA Deep Linking**: Direct browser navigation to `/cycle`, `/reports`, `/reminders` returns 200 OK.

---

## 5. Operations & Incident Readiness

- [x] **Liveness Probe**: `GET /healthz` returns 200 OK (`{"status":"ok"}`).
- [x] **Readiness Probe**: `GET /readyz` returns 200 OK (`{"status":"ready","database":"connected"}`).
- [x] **Uptime Monitoring**: Automated GitHub Actions health monitor workflow runs every 6 hours and alerts on failure.
- [x] **Dependabot Security**: Weekly dependency scanning configured in `.github/dependabot.yml`.
- [x] **Instant Rollback**: Documented procedure in `RUNBOOK.md` via Vercel Dashboard (0-second DNS cutover).
- [x] **Incident Runbooks**: Step-by-step procedures documented for 7 production failure scenarios.

---

## 6. Confirmed Known Limitations

The following limitations are confirmed from the codebase and should be clearly communicated to users:

1. **No Self-Service Password Reset**: Account recovery requires contacting the administrator; email-based password reset is on the post-launch roadmap.
2. **No Email Verification**: Email accounts are active upon registration without email confirmation.
3. **Reminders are Preference-Only**: Reminder schedules are stored in the database, but background push/SMS notifications are not yet dispatched (requires external scheduler).
4. **AI Assistance is Optional & Disabled by Default**: Application functions completely with safe fallback guidance when AI is unconfigured.
5. **Storage is Ephemeral Without S3**: Local uploads are not persistent across serverless function instances; durable multi-instance file uploads require configuring S3/Cloudflare R2.
6. **Vercel Hobby Execution Limits**: Function execution timeout is 10 seconds (standard for serverless APIs); long-running background tasks cannot run inside the function.

---

## 7. Launch Decision

| Criteria | Status |
| :--- | :---: |
| Infrastructure & Hosting | **READY** |
| Security & Privacy | **READY** |
| Database & Backups | **READY** |
| Core Product Features | **READY** |
| Operations & Monitoring | **READY** |
| **OVERALL REAL-USER LAUNCH STATUS** | **APPROVED / GO FOR LAUNCH** |
