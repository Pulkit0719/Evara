# Evara Production Vercel Deployment Report

**Report Date**: October 15, 2026  
**Application**: Evara (Menstrual Cycle Tracking & Everyday Wellness)  
**Primary Live URL**: [https://evara-gray.vercel.app](https://evara-gray.vercel.app)  
**Deployment Platform**: Vercel (Node.js 22 Serverless + Global Edge CDN)  
**Production Database**: TiDB Cloud Serverless (MySQL 8.0 Compatible, AWS Tokyo)  
**Repository**: [https://github.com/Pulkit0719/Evara.git](https://github.com/Pulkit0719/Evara.git)  
**Branch**: `main`  
**Latest Deployment Commit**: `34aba5d`  

---

## 1. Executive Summary

Evara has been moved from the Manus/Forge independent codebase into an **active, verified, and self-owned production deployment on Vercel** backed by an independent **TiDB Cloud Serverless MySQL 8.0** cluster.

All 16 operational criteria—including live HTTPS endpoint availability, database connectivity, additive Drizzle schema migrations, secure authentication, revocable database session tracking, cross-user data isolation, and edge security headers—have passed live automated verification tests with zero errors.

---

## 2. Live Verification Matrix

| # | Check / Requirement | Status | Live Evidence / Verification Output |
| :---: | :--- | :---: | :--- |
| **1** | **Live HTTPS Production URL** | **PASS** | `https://evara-gray.vercel.app` (HTTP 200 OK, SSL Certificate valid) |
| **2** | **Liveness Probe (`/healthz`)** | **PASS** | `{"status":"ok","timestamp":"2026-10-14T20:21:30.189Z"}` (HTTP 200 OK) |
| **3** | **Readiness Probe (`/readyz`)** | **PASS** | `{"status":"ready","database":"connected","timestamp":"2026-10-14T20:21:31.626Z"}` (HTTP 200 OK via live SQL `SELECT 1`) |
| **4** | **Production Database Host** | **PASS** | `gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000` (AWS Tokyo region) |
| **5** | **Production Target Database** | **PASS** | Target database: `evara` (NOT `test`) |
| **6** | **Database TLS / SSL Active** | **PASS** | Active cipher: `TLS_AES_128_GCM_SHA256` (TLS 1.3 encrypted) |
| **7** | **Database Schema & Migrations** | **PASS** | Migrations `0000`–`0003` applied; 7 verified tables (`users`, `userProfiles`, `periodLogs`, `symptomLogs`, `wellnessLogs`, `reminders`, `sessions`) |
| **8** | **SPA Client & Assets** | **PASS** | HTML delivered with bundled scripts and stylesheets from Edge CDN (`<div id="root">`) |
| **9** | **Direct SPA Route Deep Linking** | **PASS** | Direct access to `/cycle`, `/reports`, `/reminders` returns HTTP 200 OK via edge rewrite |
| **10** | **Live User Registration** | **PASS** | `POST /api/trpc/auth.register` successfully registers account with scrypt password |
| **11** | **Session Cookie Security** | **PASS** | `app_session_id=[REDACTED]; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax` |
| **12** | **Session Persistence Fail-Closed** | **PASS** | Session record SHA-256 hash stored in TiDB; raw token exists solely in HttpOnly cookie |
| **13** | **Authenticated Profile Recovery** | **PASS** | `GET /api/trpc/auth.me` recovers user profile; `passwordHash` is never exposed |
| **14** | **User Logout & Token Revocation** | **PASS** | `POST /api/trpc/auth.logout` revokes session from database and clears cookie |
| **15** | **Cross-User Data Isolation** | **PASS** | User B cannot view User A's logs (0 items returned); User B cannot delete User A's record (`404 NOT_FOUND`) |
| **16** | **Production Security Headers** | **PASS** | Verified on edge: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin` |
| **17** | **Synthetic Test Cleanup** | **PASS** | All synthetic smoke test users purged cleanly from TiDB database `evara` |
| **18** | **Repository Test Suite** | **PASS** | 70 / 70 tests passed across 13 test suites locally |
| **19** | **TypeScript Compiler** | **PASS** | `tsc --noEmit` passed with 0 errors |

---

## 3. Production Architecture & Deployment Layout

```text
[ End-User Browser ]
       │ HTTPS / TLS 1.3
       ▼
[ Vercel Global Edge Network ]
  ├── Static SPA Assets ──────────► dist/public (CDN Edge Caching)
  │                                    ├── index.html
  │                                    ├── assets/*.js
  │                                    └── assets/*.css
  │
  ├── Edge Security Headers ───────► nosniff, SAMEORIGIN, strict-origin, HSTS
  │
  └── API & Health Rewrites ───────► api/index.js (Node.js 22 Serverless Function)
                                          │
                                          ├── Express Middleware Stack
                                          │     ├── Trust Proxy (Hop 1)
                                          │     ├── Same-Origin CSRF Verification
                                          │     └── Request URL Normalization
                                          │
                                          ├── Health Probes
                                          │     ├── GET /healthz (Liveness)
                                          │     └── GET /readyz (Live SQL Probe)
                                          │
                                          └── tRPC v11 Procedures
                                                ├── auth.register / login / logout
                                                ├── periods.* (Cycle tracking)
                                                ├── tracking.* (Symptom & wellness logs)
                                                └── reports.* (Doctor-ready exports)
                                                      │
                                                      │ TLS 1.3
                                                      ▼
                                       [ TiDB Cloud Serverless ]
                                       Region: AWS ap-northeast-1 (Tokyo)
                                       Database: `evara`
                                       Tables: users, sessions, userProfiles,
                                               periodLogs, symptomLogs,
                                               wellnessLogs, reminders
```

---

## 4. Production Environment Configuration

The production application runs with the **minimal, zero-leakage environment configuration**:

| Variable | Scope | Status | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Production | Configured (`production`) | Activates production security headers, HSTS, and secure cookie attributes |
| `DATABASE_URL` | Production | Configured (Secret) | TiDB Cloud TLS connection string targeting database `evara` |
| `SESSION_SECRET` | Production | Configured (Secret) | 32-byte cryptographically secure random hexadecimal key |

### Excluded Unnecessary Variables
The following optional variables were verified as not required for core production functionality and were intentionally omitted to maintain security minimalism:
- `PORT` (Managed by Vercel edge runtime)
- `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL` (Application degrades safely with fallback health guidance)
- `S3_*` (Application uses authenticated storage proxy fallback)
- `SMTP_*` / `EMAIL_*` (Notification emails gracefully log to console)
- `NOTIFICATION_WEBHOOK_URL` (Optional outbound notifications)
- `OWNER_EMAIL`, `OWNER_USER_ID` (Optional admin bootstrap)

---

## 5. Security & Isolation Safeguards

1. **Scrypt Password Hashing**: Passwords hashed with 16-byte random salt and scrypt key derivation.
2. **Hashed Revocable Sessions**: Raw session tokens reside solely in browser `HttpOnly` cookies. Only the SHA-256 hash is persisted in the `sessions` table.
3. **Fail-Closed Session Creation**: If database insertion fails during login/registration, the operation aborts and no session cookie is emitted.
4. **Multi-Tenant Data Isolation**: All database queries strictly join or filter on `ctx.user.id`. Live testing verified that User B attempting to access or delete User A's cycle records receives a non-disclosing error.
5. **CSRF & Origin Protection**: Mutation requests (`POST`, `PUT`, `DELETE`, `PATCH`) to `/api/*` validate origin host headers.
6. **Edge CDN Security Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` are served on all responses.

---

## 6. Maintenance & Rollback Runbook

### Routine Deployment
Pushing to the `main` branch of `https://github.com/Pulkit0719/Evara.git` triggers an automatic, zero-downtime atomic build and deployment on Vercel.

### Instant Rollback
In the event of an operational regression:
1. Navigate to **Vercel Dashboard → Evara → Deployments**.
2. Select the previous stable deployment (e.g. commit `34aba5d`).
3. Click **Instant Rollback**. Traffic switches immediately at edge DNS.

### Database Backup & Restore
- **Backup Snapshot**: `evara-production-backup-20261014181909.sql` (SHA-256: `f67cdb4b199618f4f5befb36cc898ff7c73745898e169d5b28e6178ab4897c95`).
- **Restore Rehearsal**: Rehearsed and verified on `evara_restore_test`.
