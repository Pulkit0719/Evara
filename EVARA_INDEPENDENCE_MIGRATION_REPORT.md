# EVARA INDEPENDENCE MIGRATION REPORT

**Author:** Lead Software Architect, Security & DevOps Engineer  
**Project:** Evara  
**Date:** October 2026  
**Status:** COMPLETE — ZERO MANUS RUNTIME DEPENDENCIES  

---

## 1. Executive Summary

Evara has undergone a complete, rigorous independence migration. The repository is now 100% self-owned, self-hosted, vendor-agnostic, and production-ready.

All proprietary Manus and Forge runtime adapters, environment dependencies, sandbox plugins, hardcoded fallback mechanisms, unauthenticated storage endpoints, and unsafe legacy account claim flows have been completely eliminated. The application now runs with local password authentication (scrypt), SHA-256 hashed database sessions, deterministic Drizzle migrations, authenticated user-scoped storage, lightweight database readiness probes, production security headers, same-origin CSRF protection, and a provider-independent AI and SMTP mail abstraction.

All 61 automated tests across 12 test suites pass with zero failures.

---

## 2. Starting Architecture

The original repository baseline had the following legacy vendor traces and security vulnerabilities:
- **Manus & Forge Fallbacks**: `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, and `OAUTH_SERVER_URL` in `server/_core/env.ts` and `server/_core/llm.ts`.
- **Legacy Storage Proxy**: Route `/manus-storage/*` redirected to `/api/storage/*`, and `/api/storage/*` was completely open without authentication or user authorization checks.
- **Legacy Account Claim Vulnerability**: `auth.claimLegacyAccount` permitted setting a new password on an existing account merely by knowing the email address without verifying the legacy token.
- **Fail-Open Session Persistence**: Session creation caught database persistence errors and still issued valid session cookies to the client.
- **Plaintext Session Tokens**: Session tokens were stored as raw random strings directly in the database.
- **Broken Drizzle Migration Journal**: Migration `0003_add_local_auth_and_sessions.sql` existed on disk but was missing from `drizzle/meta/_journal.json` and lacked `0003_snapshot.json`.
- **Unused Dependencies**: `axios`, `jose`, `streamdown`, `@types/google.maps`, and `add` remained in `package.json`.
- **Readiness Probe**: `/readyz` only checked if the Drizzle instance was instantiated in memory, never validating real database connectivity.

---

## 3. Final Architecture

```text
[ Browser Client ]
        │
        ▼ (Same-Origin HTTPS)
[ Express Server ]
   ├── Production Security Headers (CSP, HSTS, X-Frame-Options, Referrer-Policy)
   ├── Origin CSRF Guard (Verifies Origin vs Host on POST/PUT/DELETE)
   ├── /healthz (Liveness: Process Alive)
   ├── /readyz  (Readiness: Runs SELECT 1 against MySQL)
   ├── /api/storage/* (Authenticated & User-Scoped Authorization Proxy)
   └── /api/trpc/*
        ├── Context: Validates SHA-256 Hashed Database Session
        ├── Protected Procedures: Enforce ctx.user.id Ownership Boundary
        └── Database Access: Drizzle ORM
                 │
                 ▼
     [ MySQL 8.0+ Database ]
       ├── users (local scrypt credentials & legacy openId record)
       ├── sessions (SHA-256 hashed session token, expiration)
       ├── userProfiles, periodLogs, symptomLogs, wellnessLogs, reminders
```

---

## 4. Manus & Forge Dependencies Found

1. `server/_core/env.ts`: `forgeApiUrl`, `forgeApiKey`, `oAuthServerUrl`.
2. `server/_core/llm.ts`: Fallback `ENV.forgeApiKey`.
3. `server/_core/storageProxy.ts`: Legacy route `/manus-storage/*`.
4. `shared/const.ts`: Legacy OAuth state encoding functions (`encodeOAuthState`, `decodeOAuthState`, `OAUTH_STATE_COOKIE`, `AXIOS_TIMEOUT_MS`).
5. `client/src/components/AIChatBox.tsx`: Unused scaffold component importing `streamdown`.
6. `package.json`: `axios`, `jose`, `streamdown`, `@types/google.maps`, `add`.
7. `drizzle/meta/_journal.json`: Missing registration for migration `0003`.

---

## 5. Manus & Forge Dependencies Removed

- **Removed**: `forgeApiUrl`, `forgeApiKey`, `oAuthServerUrl` from `server/_core/env.ts`.
- **Removed**: Fallback to `ENV.forgeApiKey` in `server/_core/llm.ts`.
- **Removed**: `/manus-storage/*` legacy redirect route in `server/_core/storageProxy.ts`.
- **Removed**: Legacy OAuth helper functions in `shared/const.ts`.
- **Removed**: `AIChatBox.tsx` component and its dependency `streamdown`.
- **Removed**: `axios`, `jose`, `@types/google.maps`, and `add` npm packages.

---

## 6. Manus References Intentionally Retained

- **`users.openId` column**: Retained in `drizzle/schema.ts` and historical migrations `0000`–`0003` to ensure that historical user records are never corrupted or deleted, and to serve as the secure legacy verification credential.

---

## 7. Authentication Changes

1. **Fail-Closed Session Persistence**: `createSession` now throws an error if writing to the `sessions` table fails. No session cookie is ever issued unless persistence succeeds.
2. **Session Token Hashing (SHA-256)**: Tokens are generated with 32 bytes of cryptographic entropy. Only their SHA-256 hash is stored in `sessions.id`. Raw tokens exist solely in the browser's HttpOnly cookie.
3. **Legacy Account Claim Secured**: `claimLegacyAccount` requires `verificationToken` matching `user.openId`. Email-only claiming is rejected with `403 Forbidden`.
4. **Rate Limiting**: Maintained at 10 attempts per 15-minute window per IP.

---

## 8. Database Changes

- User table `openId` preserved for compatibility.
- User table `passwordHash` stored using scrypt format (`salt:derivedKeyHex`).
- Sessions table `id` holds 64-character SHA-256 token hashes.
- All relations maintain cascading deletion on user deletion.

---

## 9. Migration Changes

- Reconciled `drizzle/meta/_journal.json` to register entry `idx: 3` (`0003_add_local_auth_and_sessions`).
- Formatted `drizzle/0003_add_local_auth_and_sessions.sql` with statement breakpoints (`--> statement-breakpoint`).
- Verified with `drizzle-kit generate`: Reports "No schema changes, nothing to migrate".

---

## 10. Storage Changes

- `/api/storage/*` now enforces authentication via `authenticateRequest`.
- User-scoped storage paths (`users/:userId/*` or `:userId/*`) enforce ownership: requesting user must match owner ID or have `admin` role.
- Unauthenticated requests receive `401`. Cross-user attempts receive `403`.
- Removed legacy `/manus-storage/*` endpoint.

---

## 11. AI Changes

- AI is 100% optional; application runs fully without AI.
- Universal provider adapter supports Google Gemini Free Tier, Groq Free Tier, Local Ollama, and OpenAI-compatible endpoints.
- Quota exhaustion (HTTP 429) fails gracefully with zero billing risk.

---

## 12. Email Changes

- Created `server/services/email.ts` providing provider-independent SMTP mail abstraction.
- Unconfigured email logs gracefully to server console without crashing.

---

## 13. Environment Variables

Cleanly organized in `.env.example`:
- `APPLICATION`: `NODE_ENV`, `PORT`, `APP_URL`, `VITE_APP_ID`, `VITE_APP_TITLE`
- `DATABASE`: `DATABASE_URL`
- `AUTHENTICATION`: `SESSION_SECRET`
- `ADMIN`: `OWNER_EMAIL`, `OWNER_USER_ID`
- `AI`: `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`
- `STORAGE`: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `EMAIL`: `EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`
- `WEBHOOKS`: `NOTIFICATION_WEBHOOK_URL`

---

## 14. Security Improvements

1. **CSRF Protection**: Same-origin validation for state-changing HTTP methods (`POST`, `PUT`, `DELETE`).
2. **HTTP Headers**: HSTS, nosniff, SAMEORIGIN, strict-origin-when-cross-origin, Permissions-Policy.
3. **Database Readiness Probe**: `/readyz` runs `SELECT 1` on MySQL.
4. **Data Export Sanitization**: Strips internal `userId` and internal scheduler IDs from export JSON.

---

## 15. Dependencies Removed

- `axios` (1.12.2)
- `jose` (6.1.0)
- `streamdown` (1.4.0)
- `@types/google.maps` (3.58.1)
- `add` (2.0.6)

---

## 16. Dependencies Added

- Zero external vendor packages added. All improvements achieved using Node.js built-ins (`crypto`, `net`, `http`) and existing packages (`cross-env`).

---

## 17. Test Results

- Total Test Suites: 12 passed (12)
- Total Tests: 61 passed (61)
- Test Suites:
  1. `server/ui.accessibility.test.ts` (3 tests)
  2. `server/ui.responsive.test.ts` (3 tests)
  3. `server/ai.service.test.ts` (8 tests)
  4. `server/lib/evara.test.ts` (6 tests)
  5. `server/reports.test.ts` (2 tests)
  6. `server/ownership.test.ts` (4 tests)
  7. `server/storage.test.ts` (4 tests)
  8. `server/storage.auth.test.ts` (4 tests)
  9. `server/auth.logout.test.ts` (1 test)
  10. `server/auth.local.test.ts` (18 tests)
  11. `server/health.test.ts` (4 tests)
  12. `server/migrations.test.ts` (4 tests)

---

## 18. Build Results

- Frontend build (`vite build`): PASS (Transformed 2404 modules, generated dist/public assets).
- Backend bundle (`esbuild server/_core/index.ts`): PASS (`dist/index.js` generated, 55.8kb).

---

## 19. Docker Results

- `Dockerfile` verified: multi-stage build, non-root user (`node`), healthcheck on `/healthz`.
- `docker-compose.yml` verified: includes `app`, `db` (MySQL 8.0), and optional `minio`.

---

## 20. Deployment Readiness

The repository is ready for production deployment from your GitHub repository to Docker, VPS, Railway, Render, or Fly.io.

---

## 21. Remaining External Services

- **MySQL Database**: Required (hosted by you or managed provider).
- **S3 Storage**: Optional (falls back to local disk).
- **AI Provider**: Optional (falls back to disabled).
- **SMTP Server**: Optional (falls back to console log).

---

## 22. Accounts You Must Own

- GitHub Account (Repository hosting).
- Database Host (Self-hosted MySQL, TiDB Cloud, PlanetScale, or VPS).
- (Optional) AI Provider API Key (Google AI Studio, Groq, or OpenAI).
- (Optional) S3-compatible bucket (Cloudflare R2, AWS S3, or MinIO).

---

## 23. Remaining Risks & Mitigations

- **Single-process Rate Limiting**: In multi-instance clustering, memory-based rate limiting is per-process. Mitigation: For multi-instance horizontal scaling, deploy behind an API gateway / reverse proxy rate limiter (e.g. Nginx, Cloudflare) or Redis.

---

## 24. Known Limitations

- Reminders remain private user preferences and do not yet dispatch SMS or push notifications. This is clearly disclosed in the user interface.

---

## 25. Backup & Restore Status

- Backup and restore procedures documented in `BACKUP_RESTORE.md`.
- Single-transaction `mysqldump` and Docker dump procedures verified.

---

## 26. Git Commits Created

1. `0d5ff39`: `fix(db): reconcile drizzle local auth migration journal and snapshot`
2. `1e2e13e`: `chore(deps): remove unused dependencies, AIChatBox component, and fix start script for cross-platform`
3. `f55c7e5`: `security: harden auth, protect storage proxy, fail closed on session persistence, and remove vendor fallbacks`

---

## 27. Deployment Instructions

```bash
git clone <your-repo>
cd evara-project-extracted
pnpm install --frozen-lockfile
cp .env.example .env
# Edit DATABASE_URL and SESSION_SECRET in .env
pnpm db:push
pnpm build
pnpm start
```

---

## 28. Rollback Instructions

```bash
# To rollback to pre-migration baseline:
git checkout main
# Or checkout specific commit hash 85766e1
```

---

## FINAL OWNERSHIP CHECK

| Question | Status |
|---|---|
| Can the application run without Manus? | **YES** |
| Can users register without Manus? | **YES** |
| Can users log in without Manus? | **YES** |
| Can sessions work without Manus? | **YES** |
| Can the database work without Manus? | **YES** |
| Can migrations run without Manus? | **YES** |
| Can storage work without Manus? | **YES** |
| Can AI work without Manus? | **YES** |
| Can deployment happen without Manus? | **YES** |
| Can the repository build without Manus? | **YES** |
| Are all required credentials controlled by me? | **YES** |
| Can I move the project to another host? | **YES** |
| Can I move the database to another provider? | **YES** |
| Can I replace the AI provider? | **YES** |
| Can I replace storage provider? | **YES** |
| Can I back up all critical application data? | **YES** |

---

## SUCCESS CRITERIA VERIFICATION

| Criteria | Status |
|---|---|
| MANUS RUNTIME DEPENDENCY = 0 | **PASS** |
| FORGE RUNTIME DEPENDENCY = 0 | **PASS** |
| LOCAL AUTHENTICATION | **PASS** |
| LEGACY ACCOUNT SECURITY | **PASS** |
| SESSION PERSISTENCE (FAIL CLOSED) | **PASS** |
| DATABASE MIGRATIONS | **PASS** |
| USER DATA PRESERVED | **PASS** |
| CROSS-USER AUTHORIZATION | **PASS** |
| PRODUCTION BUILD | **PASS** |
| TYPECHECK | **PASS** |
| TESTS (61/61 PASS) | **PASS** |
| SECRET SCAN | **PASS** |
| INDEPENDENT DEPLOYMENT | **READY** |
| ROLLBACK PLAN | **DOCUMENTED** |
| BACKUP STRATEGY | **DOCUMENTED** |
