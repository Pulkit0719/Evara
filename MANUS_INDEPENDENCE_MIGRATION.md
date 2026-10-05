# Manus Independence Migration & Architecture Report

## 1. Overview

This document details the complete technical migration of the application to become **100% independent, self-hosted, self-controlled, maintainable, and deployable without any reliance on Manus AI, Forge infrastructure, or proprietary runtime services**.

All proprietary abstractions, OAuth bridges, proxy endpoints, analytics tracking, and generated boilerplate have been replaced with standard, enterprise-grade, open-source solutions.

---

## 2. Manus Dependency Inventory & Replacement Map

| Component | Original Manus/Forge Dependency | Purpose in Original App | Files Affected | Migration Action | Independent Replacement |
|---|---|---|---|---|---|
| **Authentication** | Manus OAuth Portal & JWKS verification (`api.manus.im`) | User authentication & sessions | `server/_core/oauth.ts`, `server/_core/sdk.ts`, `server/_core/context.ts`, `client/src/_core/hooks/useAuth.ts`, `client/src/const.ts` | **REPLACE** | Local authentication using Node's built-in `crypto.scrypt` password hashing, server-controlled database-backed revocable sessions, and HttpOnly `SameSite=Lax` cookies. |
| **Legacy User Migration** | External `openId` from Manus OAuth | Historical user identification | `drizzle/schema.ts`, `server/db.ts`, `server/routers/auth.ts`, `client/src/components/AuthModal.tsx` | **REFACTOR** | Additive schema migration adding `passwordHash`. Seamless "Claim Legacy Account" procedure that preserves existing user IDs, relational records, and health data. |
| **Session Management** | Ephemeral Manus tokens / cookies | Session tracking | `server/_core/cookies.ts`, `server/services/auth.ts` | **REPLACE** | Explicit database `sessions` table (`id`, `userId`, `expiresAt`, `userAgent`, `ipAddress`) with server-side validation and revocation. |
| **AI Integration** | `https://forge.manus.im/v1/chat/completions` using `BUILT_IN_FORGE_API_KEY` | LLM text completions | `server/_core/llm.ts`, `server/services/ai.ts` | **REPLACE** | Provider-independent universal adapter (`AIService`) compatible with any OpenAI-compatible provider (OpenAI, Groq, Ollama, DeepSeek, vLLM) configured via `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`. |
| **Object Storage** | Forge storage presigned URL proxy (`/manus-storage/*`) | File uploads and downloads | `server/storage.ts`, `server/_core/storageProxy.ts` | **REPLACE** | Standard S3-compatible client (`@aws-sdk/client-s3`) supporting AWS S3, Cloudflare R2, MinIO, or Backblaze B2, plus an automatic local disk fallback (`.storage/uploads/`) and secure `/api/storage/*` route. |
| **Notifications** | Manus WebDev RPC (`WebDevService/SendNotification`) | Owner alert dispatching | `server/_core/notification.ts`, `server/_core/systemRouter.ts` | **REPLACE** | Independent HTTPS webhook dispatcher (`NOTIFICATION_WEBHOOK_URL`) with graceful local console logging fallback when unconfigured. |
| **Analytics** | Injected Umami tracking script (`manus-analytics.com`) | Telemetry tracking | `client/index.html` | **REMOVE** | Completely removed to preserve user privacy and prevent third-party tracking. |
| **Dev Runtime** | `vite-plugin-manus-runtime` plugin | Manus sandbox dev injection | `package.json`, `pnpm-lock.yaml` | **REMOVE** | Removed dependency and cleaned lockfile. |
| **Template Boilerplate** | Unused Forge service stubs (maps proxy, heartbeat cron, speech-to-text, dataApi) | Scaffold template extras | `server/_core/dataApi.ts`, `server/_core/heartbeat.ts`, `server/_core/imageGeneration.ts`, `server/_core/voiceTranscription.ts`, `server/_core/map.ts`, `client/src/components/Map.tsx` | **REMOVE** | Deleted all unused template files with zero impact on application functionality. |
| **Metadata & Checkpoints** | `.manus/` directory and `.project-config.json` | Manus sandbox state | `.manus/`, `.project-config.json`, `.gitignore` | **REMOVE** | Deleted artifacts and sanitized `.gitignore`. |

---

## 3. Architecture Overview

```text
Browser / Client (React 19, Tailwind CSS, Vite)
      │
      ├── UI Forms / Modals / App Shell
      └── tRPC Client (Typed Queries & Mutations)
            │
            ▼ [HTTP / JSON via /api/trpc]
Application Server (Express, Node.js)
      │
      ├── Security Middleware (X-Content-Type-Options, X-Frame-Options)
      ├── Health Checks (/healthz, /readyz)
      │
      ├── Authentication & Session Layer
      │     ├── Password Hashing (crypto.scrypt + 16-byte random salt)
      │     ├── Rate Limiting (In-memory IP attempt counter)
      │     ├── Server-Controlled Revocable Sessions (HttpOnly Cookie, SameSite=Lax)
      │     └── Legacy Account Migration (Claim & Password Setting)
      │
      ├── Storage Service (/api/storage/*)
      │     ├── S3-Compatible Storage (AWS S3, Cloudflare R2, MinIO)
      │     └── Local Disk Fallback (.storage/uploads/)
      │
      ├── AI Service Interface
      │     └── OpenAI-Compatible Universal Adapter (AI_BASE_URL, AI_API_KEY, AI_MODEL)
      │
      ├── Notification Dispatcher
      │     └── Webhook / Event Logger (NOTIFICATION_WEBHOOK_URL)
      │
      └── Database Access (Drizzle ORM, MySQL2)
            │
            ▼
      MySQL / TiDB Database
            ├── users (with passwordHash, role, lastSignedIn)
            ├── sessions (revocable session tokens)
            ├── userProfiles (tracking goals & parameters)
            ├── periodLogs (per-user period records)
            ├── symptomLogs (per-user symptoms)
            ├── wellnessLogs (per-user wellness logs)
            └── reminders (user-owned reminders)
```

---

## 4. Database Schema Changes & Backward Compatibility

The database migration is **purely additive**. No existing tables, columns, or relations were dropped or destructively modified.

### Migration SQL (`drizzle/0003_add_local_auth_and_sessions.sql`):

```sql
-- Add passwordHash column to users for local authentication (nullable for legacy users)
ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255);
CREATE INDEX `users_email_idx` ON `users` (`email`);

-- Server-controlled revocable sessions table
CREATE TABLE `sessions` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `userAgent` varchar(255),
  `ipAddress` varchar(45),
  CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
  CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade
);

CREATE INDEX `sessions_user_idx` ON `sessions` (`userId`);
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expiresAt`);
```

### Legacy Account Preservation:
- Existing users previously created through Manus OAuth have their records intact in the `users` table with their original `id`, `openId`, `email`, and `name`.
- Because foreign keys for `userProfiles`, `periodLogs`, `symptomLogs`, `wellnessLogs`, and `reminders` reference `users.id`, no relation is broken.
- When an existing user accesses the application, they can use the **Migrate / Claim Account** option to set a strong local password. This updates `passwordHash` without altering their user ID or any associated health logs.

---

## 5. Security Hardening Improvements

1. **Password Security**:
   - Modern `scrypt` hashing with cryptographically secure random 16-byte salt per user.
   - `crypto.timingSafeEqual` prevents timing-based side-channel attacks during verification.
   - Password hashes are strictly stripped from all tRPC responses (`sanitizeUser`).
2. **Session Security**:
   - Session identifiers are 256-bit cryptographically secure random hexadecimal strings (`crypto.randomBytes(32)`).
   - Cookies configured with `HttpOnly: true`, `SameSite: "lax"` (mitigating CSRF), `Secure: true` in production / HTTPS, and `Path: "/"`.
   - Explicit database-backed session table allows server-side revocation on logout and global session invalidation.
3. **Rate Limiting**:
   - Built-in authentication rate limiting on `/api/trpc/auth.login`, `/api/trpc/auth.register`, and `/api/trpc/auth.claimLegacyAccount` (max 10 attempts per 15-minute window per IP).
4. **Storage Security**:
   - Key sanitization prevents directory traversal attacks (`../` stripping and root directory containment verification).
   - S3 presigned URLs have constrained TTL (default 1 hour).
5. **Infrastructure Security**:
   - HTTP security headers added (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`).
   - Liveness (`/healthz`) and readiness (`/readyz`) endpoints added without leaking database connection secrets.

---

## 6. Environment Configuration

All environment variables have been sanitized into `.env.example`:

| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Application environment (`development` \| `production`) | `development` |
| `PORT` | Local HTTP port | `3000` |
| `DATABASE_URL` | MySQL / TiDB database connection URI | `mysql://user:pass@host:3306/db` |
| `SESSION_SECRET` | Secret key used for session cookie signing | Random 32+ character hex string |
| `OWNER_EMAIL` | Application owner email for admin role assignment | `admin@example.com` |
| `OWNER_USER_ID` | Application owner user ID (optional) | `1` |
| `AI_BASE_URL` | OpenAI-compatible endpoint URL | `https://api.openai.com/v1` |
| `AI_API_KEY` | API key for AI provider | `sk-...` |
| `AI_MODEL` | Default model name | `gpt-4o-mini` |
| `S3_ENDPOINT` | Custom S3 endpoint (for Cloudflare R2, MinIO, B2) | Optional |
| `S3_REGION` | S3 bucket region | `us-east-1` |
| `S3_BUCKET` | S3 bucket name | Optional (falls back to local disk) |
| `S3_ACCESS_KEY_ID` | S3 Access Key ID | Optional |
| `S3_SECRET_ACCESS_KEY` | S3 Secret Access Key | Optional |
| `NOTIFICATION_WEBHOOK_URL` | Outbound notification webhook | Optional |

---

## 7. Rollback Plan

If rollback is ever required:
1. Git: The original state is permanently recorded on commit `4d140cf` on branch `main`.
2. Database: The additive migration adds columns and tables without dropping existing tables or modifying existing columns. Rolling back only requires:
   ```sql
   DROP TABLE IF EXISTS `sessions`;
   ALTER TABLE `users` DROP COLUMN `passwordHash`;
   ```
3. User Data: No user data is destroyed or converted in a lossy way during the migration.
