# Evara

Privacy-focused full-stack cycle and everyday wellness tracking platform built with independent authentication, user-scoped data protection, TiDB Serverless persistence, and automated zero-cost encrypted offsite backups.

**Live Application**: [https://evara-gray.vercel.app](https://evara-gray.vercel.app)

[![CI](https://github.com/Pulkit0719/Evara/actions/workflows/ci.yml/badge.svg)](https://github.com/Pulkit0719/Evara/actions/workflows/ci.yml)
[![Release](https://img.shields.io/badge/release-v1.0.0--independent-1F7863?logo=github)](https://github.com/Pulkit0719/Evara/releases/tag/v1.0.0-independent)
[![Tests](https://img.shields.io/badge/tests-70%20passed-2ea44f?logo=vitest&logoColor=white)](https://github.com/Pulkit0719/Evara/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node-%3E%3D22.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-000000?logo=vercel&logoColor=white)](https://evara-gray.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

Evara is a modern full-stack web platform engineered for privacy-conscious menstrual cycle tracking and daily wellness management. Designed from the ground up with zero proprietary vendor lock-in, Evara gives users complete, confidential ownership over their personal health narratives without third-party tracking, ad networks, or data monetization.

The platform provides a comprehensive personal health workflow:
- **Cycle Logging & History**: Record period start and end dates, log flow intensities (`light`, `medium`, `heavy`), and compute rolling cycle averages.
- **Interactive Calendar**: Visualize personal cycle phases, estimated upcoming windows, daily symptom entries, and wellness markers on a dynamic monthly timeline.
- **Multi-Metric Symptom Tracking**: Log daily physical symptoms with structured severity tiers (`mild`, `moderate`, `severe`) and contextual notes.
- **Holistic Wellness Check-ins**: Record daily mood, energy levels, sleep duration, water intake, physical activity minutes, stress levels, and pain scores.
- **Personal Trend Insights**: Review private analytical summaries showing recurring symptom patterns, energy curves, and mood trends across different cycle phases without diagnostic claims.
- **Physician Summaries & JSON Export**: Export complete personal health data on demand in standardized, portable JSON format or generate printer-friendly summaries.
- **Independent Security & Identity**: Authenticate via self-contained email/password credentials with native `crypto.scrypt` hashing, SHA-256 hashed database sessions, and strict user-isolated query enforcement.

*Disclaimer: Evara is designed for personal wellness tracking and informational organization. It does not provide medical diagnoses, treatment recommendations, or clinical predictions.*

---

## Why Evara

Intimate health data is among the most sensitive personal information an individual generates:
- Many commercial period and wellness tracking applications centralize intimate logs on opaque third-party infrastructure, often exposing records to telemetry, advertising SDKs, and data brokers.
- Traditional developer templates and prototypes frequently introduce heavy runtime dependencies on proprietary identity providers, vendor-hosted storage gateways, or paid API lock-in.
- Applications handling personal wellness require unambiguous security boundaries: strict tenant isolation, authenticated database sessions, encrypted backups, and verifiable operator independence.

Evara solves this by delivering an enterprise-grade full-stack architecture that is entirely self-hosted, vendor-independent, and operationally hardened. Every database read, mutation, and deletion is cryptographically bound to the authenticated user ID, providing an uncompromised standard of personal health privacy.

---

## Key Features

| Feature Group | Capabilities |
| :--- | :--- |
| **Cycle Tracking** | Record period intervals, flow intensity (`light`, `medium`, `heavy`), calculate average cycle lengths, and estimate upcoming cycle ranges based on personal history. |
| **Interactive Calendar** | Responsive monthly calendar view with color-coded period markers, estimated cycle ranges, daily symptom logs, and wellness check-in indicators. |
| **Symptom Intelligence** | Log daily symptoms across categorized physical indicators with three severity levels (`mild`, `moderate`, `severe`) and searchable notes. |
| **Wellness Check-ins** | Multi-dimensional daily tracking across mood, energy, sleep hours, water consumption (glasses), activity minutes, stress, and pain ratings. |
| **Personal Insights** | Aggregate pattern visualization correlating symptoms, sleep duration, and mood trends across personal cycle phases. |
| **Reports & Data Export** | Generate printable physician-ready summaries and export comprehensive user health records in clean, portable JSON format. |
| **Independent Auth** | Built-in email/password credentials using Node.js native `crypto.scrypt` password hashing, unique random salts, and SHA-256 database-backed revocable sessions. |
| **Zero-Cost Offsite Backups** | Client-side `AES-256-GCM` encrypted backups with `gzip` Level 9 compression, SHA-256 checksums, and automated synchronization to private Microsoft OneDrive. |
| **Privacy & Access Control** | Strictly scoped user ownership filters on all database queries, cascading account deletion, and `HttpOnly` `SameSite=Lax` cookie defense. |

---

## Tech Stack

### Frontend
- **Framework**: React 19 with TypeScript 5.9
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4, Radix UI design primitives, Lucide Icons
- **State & Routing**: Wouter (lightweight client routing), TanStack Query v5 (server state caching)
- **API Client**: tRPC v11 React Client with SuperJSON serialization
- **Visualizations**: Recharts, Framer Motion animations

### Backend & API
- **Runtime**: Node.js 22 (Vercel Serverless Function & Standalone ESM)
- **Server Framework**: Express 4
- **API Layer**: tRPC v11 (end-to-end type-safe RPC procedures)
- **Validation**: Zod schema validation on all API inputs and environment variables
- **Security Headers**: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`

### Database & Persistence
- **Database Engine**: TiDB Cloud Serverless (MySQL 8.0 compatible, AWS Tokyo)
- **Connection Security**: Enforced TLS 1.3 with SSL connection pooling (`mysql2/promise`)
- **ORM & Migrations**: Drizzle ORM 0.44, Drizzle Kit with deterministic migration lineage (`0000` to `0003`)
- **Integrity**: Foreign keys with `onDelete: "cascade"` preventing orphaned health records

### Authentication & Cryptography
- **Password Hashing**: Node.js native `crypto.scrypt` with 64-byte derived keys and unique 16-byte random salts
- **Session Tokens**: Cryptographically random session tokens stored exclusively as SHA-256 hashes in MySQL
- **Cookie Security**: `HttpOnly`, `Secure` (production), `SameSite=Lax`, and 7-day server-side session expiration
- **Session Persistence**: Fail-closed session creation (cookies are never set if database persistence fails)

### Testing & Quality
- **Test Runner**: Vitest 2
- **Test Coverage**: 70 passing automated tests across 13 test suites
- **Type Checking**: Strict TypeScript compiler verification (`tsc --noEmit`)

### Infrastructure & Operations
- **Hosting**: Vercel (Node.js 22 Serverless + Edge CDN)
- **Continuous Integration**: GitHub Actions automated pipeline
- **Health Monitoring**: Liveness (`/healthz`) and live SQL readiness (`/readyz`) probes
- **Disaster Recovery**: Automated client-side AES-256-GCM encrypted database dumps with Microsoft OneDrive sync and TiDB managed snapshots

---

## Architecture

```mermaid
flowchart TD
    User["User Browser\n(React 19 + Vite + Wouter)"]

    subgraph Vercel["Production Infrastructure (Vercel)"]
        direction TB
        Edge["Global Edge Network\n(HTTPS Termination / HSTS / Static Caching)"]
        Server["Express + tRPC Server\n(Node.js 22 Serverless Runtime)"]

        subgraph Middleware["Request & Security Pipeline"]
            Health["Health Probes\n(/healthz & /readyz)"]
            Auth["Independent Auth Guard\n(scrypt + SHA-256 Sessions)"]
            Origin["Origin & CSRF Check\n(Host Validation + SameSite Cookies)"]
        end

        subgraph Routers["Domain tRPC Routers"]
            CycleRouter["Cycle & Period Router"]
            CalendarRouter["Calendar & Timeline Router"]
            SymptomRouter["Symptom & Wellness Router"]
            ReportRouter["Reports & Export Router"]
        end

        subgraph ORM["Data Access Layer"]
            Drizzle["Drizzle ORM\n(User-Scoped Query Filters: WHERE userId = ctx.user.id)"]
        end
    end

    subgraph Storage["Managed Database (TiDB Cloud)"]
        TiDB[("TiDB Cloud Serverless\nMySQL 8.0 Compatible · TLS 1.3\nDatabase: evara · Multi-AZ AWS Tokyo")]
    end

    subgraph OffsiteBackup["Zero-Cost Disaster Recovery"]
        LocalEnc["Primary Encrypted Storage\n(AES-256-GCM + gzip Level 9)"]
        OneDrive["Microsoft OneDrive Offsite Sync\n(Auto-synced .enc + .sha256)"]
        TiDBSnap["TiDB Continuous Snapshots\n(30-Day Point-in-Time Recovery)"]
    end

    User -->|"HTTPS (Secure Cookies + CSRF)"| Edge
    Edge --> Server
    Server --> Health
    Server --> Origin
    Origin --> Auth
    Auth --> Routers
    Routers --> Drizzle
    Drizzle -->|"TLS 1.3 Connection Pool"| TiDB

    TiDB -.->|"Continuous PITR"| TiDBSnap
    Server -.->|"npm run db:backup"| LocalEnc
    LocalEnc -->|"Auto-Sync & Verify"| OneDrive

    classDef highlight fill:#18302F,stroke:#1F7863,stroke-width:2px,color:#fff;
    classDef storage fill:#F4FAF6,stroke:#1F7863,stroke-width:1px,color:#18302F;
    class Server,Routers,CycleRouter,CalendarRouter,SymptomRouter,ReportRouter highlight;
    TiDB,LocalEnc,OneDrive,TiDBSnap storage;
```

---

## Independent Architecture

Evara originally evolved from an externally generated application prototype. It has undergone a complete re-engineering to achieve full operator ownership and zero proprietary runtime dependencies:

1. **Proprietary SDKs Removed**: 100% free of external prototype SDKs, injected telemetry collectors, third-party OAuth gateways, and debug hooks.
2. **Independent Local Authentication**: Replaced third-party OAuth with a self-contained email/password authentication system utilizing native `crypto.scrypt` password hashing and database-backed session revocation.
3. **Portable Persistence**: Powered by a standard MySQL 8.0-compatible schema managed via Drizzle ORM. The application can run interchangeably on TiDB Cloud Serverless, AWS RDS, PlanetScale, or a local Docker MySQL container.
4. **Standard Deployment Model**: Packaged as a standard Node.js/Express server running seamlessly on modern Vercel Serverless functions, Docker, or bare-metal VPS servers.
5. **Zero Paid Cloud Storage Dependencies**: Operates completely without paid AWS S3 or Cloudflare R2 subscriptions. Offsite disaster recovery is achieved through client-side AES-256-GCM encryption synced directly to private personal cloud storage.

---

## Security & Privacy Architecture

Evara enforces a defense-in-depth security model across every layer of the system:

- **Transport Security**: Enforced HTTPS terminated with HTTP Strict Transport Security (`Strict-Transport-Security: max-age=31536000; includeSubDomains`).
- **Password Key Derivation**: Passwords hashed using Node.js native `crypto.scrypt` with 64-byte derived keys and unique 16-byte random salts. Plaintext passwords are never stored or logged.
- **Session Token Hashing**: Raw session tokens reside only in user `HttpOnly` cookies. The database stores only SHA-256 hashes of tokens, preventing token extraction even in the event of an unauthorized database dump.
- **Fail-Closed Session Persistence**: Session authentication strictly fails closed. If session creation cannot be committed to the database, no cookie is issued and authentication is denied.
- **Cross-User Data Isolation**: Every database query, update, and deletion explicitly filters by `WHERE userId = ctx.user.id`. Requests attempting to access records belonging to another user return a non-disclosing 404 response.
- **Cookie Hardening**: Session cookies use `HttpOnly`, `Secure` (production), `SameSite=Lax`, and 7-day expiration.
- **Origin & CSRF Defense**: State-changing API mutations (`POST`, `PUT`, `DELETE`, `PATCH`) validate the request `Host` header to prevent cross-site request forgery.
- **Database Transport Security**: Enforced `TLS 1.3` on all database traffic to TiDB Cloud Serverless with secure connection pooling.
- **Production Headers**: Employs `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.

---

## Database Architecture

Evara utilizes **TiDB Cloud Serverless** (MySQL 8.0 compatible, hosted in Multi-AZ AWS Tokyo) accessed via **Drizzle ORM**:

- **Database Name**: `evara`
- **Tables (8 Total)**:
  - `users`: Core identity, email, `scrypt` password hash, login method, role, and audit timestamps.
  - `sessions`: Server-revocable sessions with SHA-256 token hashes, expiration, IP, and user-agent metadata.
  - `userProfiles`: User cycle parameters (cycle length, typical duration, tracking goals).
  - `periodLogs`: Recorded period start/end dates, flow intensity (`light`, `medium`, `heavy`), and notes.
  - `symptomLogs`: Dated symptom logs with severity ratings (`mild`, `moderate`, `severe`) and notes.
  - `wellnessLogs`: Daily holistic health check-ins (mood, energy, sleep hours, water glasses, activity minutes, stress, pain).
  - `reminders`: User notification preferences, schedule frequencies, and preview strings.
  - `__drizzle_migrations`: Drizzle Kit migration history tracking migrations `0000` through `0003`.
- **Referential Integrity**: All child tables enforce `FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`. When an account is deleted, all associated health logs and sessions are atomically purged.
- **Deterministic Migrations**: Schema changes are managed via additive, versioned SQL migration files under `drizzle/` and tracked in `__drizzle_migrations`.

---

## Production Infrastructure

Evara runs on modern serverless cloud infrastructure designed for high availability and zero operational overhead:

| Component | Provider / Service | Configuration |
| :--- | :--- | :--- |
| **Web & API Hosting** | Vercel | Node.js 22 Serverless Function + Global Edge CDN |
| **Production Database** | TiDB Cloud Serverless | MySQL 8.0 Compatible · TLS 1.3 · Multi-AZ AWS Tokyo |
| **Continuous Integration** | GitHub Actions | Automated typecheck, 70-test Vitest suite, and production build |
| **Health Monitoring** | GitHub Actions & Probes | Continuous monitoring of `/healthz` and live SQL `/readyz` |
| **Disaster Recovery** | Dedicated Local + OneDrive | Client-side AES-256-GCM + gzip Level 9 + SHA-256 integrity |
| **Managed DB Snapshots**| TiDB Cloud Serverless | Continuous automated snapshots with 30-day point-in-time recovery |

---

## Production Status

| Verification Check | Specification | Status |
| :--- | :--- | :---: |
| **Production Deployment** | Vercel Serverless (Node.js 22) | ✅ Live |
| **Database Connectivity** | TiDB Cloud Serverless (AWS Tokyo) | ✅ Connected |
| **Transport Encryption** | HTTPS + TLS 1.3 Database Connection | ✅ Enforced |
| **Continuous Integration** | GitHub Actions Workflow | ✅ Passing |
| **Automated Test Suite** | Vitest (13 Test Suites) | ✅ 70/70 Passed |
| **TypeScript Compilation**| `tsc --noEmit` (Zero Errors) | ✅ Clean |
| **Cross-User Isolation** | User-scoped queries (`ctx.user.id`) | ✅ Verified Live |
| **Liveness Probe** | `/healthz` | ✅ 200 OK |
| **Readiness Probe** | `/readyz` (Live SQL Ping) | ✅ 200 OK |
| **Encrypted Backups** | Client-Side AES-256-GCM + gzip Level 9 | ✅ Active |
| **Offsite Redundancy** | Microsoft OneDrive Synchronization | ✅ Synchronized |
| **Restore Rehearsal** | End-to-end Decrypt, Replay & Verification | ✅ Passed |

---

## Local Development

### Prerequisites
- **Node.js**: `>=22.0.0`
- **pnpm**: `>=10.4.1` (Corepack enabled: `corepack enable`)
- **MySQL**: MySQL 8.0+ or TiDB Cloud Serverless instance

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Pulkit0719/Evara.git
   cd Evara
   ```

2. **Install dependencies**:
   ```bash
   pnpm install --frozen-lockfile
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and provide your database connection and session secret:
   ```env
   DATABASE_URL=mysql://root:password@127.0.0.1:3306/evara
   SESSION_SECRET=a-secure-random-32-character-secret
   ```

4. **Apply database schema migrations**:
   ```bash
   pnpm db:push
   ```

5. **Start the local development server**:
   ```bash
   pnpm dev
   ```
   The application will be accessible at [http://localhost:3000](http://localhost:3000).

---

## Development Commands

| Command | Purpose |
| :--- | :--- |
| `pnpm dev` | Starts Vite frontend development server with backend watch mode on port 3000 |
| `pnpm check` | Runs TypeScript type checking with zero code emit (`tsc --noEmit`) |
| `pnpm test` | Executes the complete 70-test Vitest test suite across 13 suites |
| `pnpm build` | Compiles Vite client and bundles Express/tRPC server with esbuild |
| `pnpm start` | Launches production server bundle (`cross-env NODE_ENV=production node dist/index.js`) |
| `pnpm db:push` | Generates schema snapshots and applies Drizzle migrations |
| `pnpm run db:backup` | Generates client-side AES-256-GCM encrypted backup and syncs to OneDrive |
| `pnpm run db:restore` | Validates SHA-256 checksum, decrypts, and executes rehearsal database restore |

---

## Testing & Quality

Evara maintains high code quality and security boundaries validated by an automated test suite:

```bash
# Typecheck with TypeScript compiler
pnpm check

# Run all unit, security, and integration tests
pnpm test

# Build production bundle
pnpm build
```

**Test Coverage**: **70 passing tests across 13 suites**:
- **Authentication & Sessions**: Registration, `scrypt` hashing, session lifecycle, and logout revocation (`server/auth.local.test.ts`, `server/auth.logout.test.ts`).
- **Security & Cross-User Isolation**: Tenant data boundary enforcement and cross-user authorization tests (`server/security.isolation.test.ts`, `server/ownership.test.ts`).
- **Storage Authorization**: User-scoped file proxy access controls (`server/storage.test.ts`, `server/storage.auth.test.ts`).
- **Health Probes**: Liveness and live database readiness endpoints (`server/health.test.ts`).
- **Database Migrations**: Additive migration integrity and foreign-key verification (`server/migrations.test.ts`).
- **Reports & Export**: Sanitized JSON health data export and doctor-ready summaries (`server/reports.test.ts`).
- **UI Accessibility & Responsiveness**: Accessible navigation, form landmarks, and mobile viewport adaptability (`server/ui.accessibility.test.ts`, `server/ui.responsive.test.ts`).
- **Cycle Calculation Logic**: Historical cycle math and rolling average estimation (`server/lib/evara.test.ts`).
- **AI Service Safety**: Graceful fallback and $0 cost enforcement when optional AI is unconfigured or rate-limited (`server/ai.service.test.ts`).

---

## CI/CD Pipeline

Evara enforces automated continuous integration on every commit to `main` via GitHub Actions (`.github/workflows/ci.yml`):

```text
[ Git Push to main ]
         │
         ├── 1. Setup Node.js 22 & pnpm 10.4.1
         ├── 2. Install Dependencies (Frozen Lockfile)
         ├── 3. Typecheck (tsc --noEmit)
         ├── 4. Automated Tests (vitest run — 70 tests)
         └── 5. Production Build Verification (Vite + esbuild)
         │
         ▼
[ Vercel Continuous Deployment ]
  Automated Production Deployment to https://evara-gray.vercel.app
```

---

## Backup & Disaster Recovery

Evara employs a zero-cost, multi-tier disaster recovery architecture that does not require credit cards or paid cloud storage:

1. **Continuous Point-in-Time Recovery**: TiDB Cloud Serverless provides automated continuous multi-AZ snapshots with 30-day point-in-time recovery.
2. **Client-Side Encrypted Backups**:
   - Dumps all 8 tables in parent-first dependency order.
   - Compresses SQL payloads with `gzip` Level 9 (~79% reduction).
   - Encrypts client-side using authenticated `AES-256-GCM` (`[12-byte IV][16-byte AuthTag][Ciphertext]`).
   - Generates independent SHA-256 checksums (`.sha256`).
3. **Automated Offsite Synchronization**:
   - Encrypted `.enc` and `.sha256` files are automatically synchronized to Microsoft OneDrive.
   - Plaintext `.sql` and unencrypted `.sql.gz` files are strictly excluded from transfer.
   - Post-transfer verification confirms destination existence, byte size match, and recalculates SHA-256 hashes.
4. **Failsafe Retention**: 7-day retention policy safely purges expired snapshots while guaranteeing the most recent valid backup is never deleted.
5. **Rehearsal Verified**: Restore rehearsal has been executed and verified (`pnpm run db:restore -- --drop-after`), confirming full schema replay and table integrity.

For comprehensive backup details, see [BACKUP_RESTORE.md](BACKUP_RESTORE.md) and [OFFSITE_BACKUP.md](OFFSITE_BACKUP.md).

---

## Known Limitations

- **No Self-Service Password Reset**: Account recovery currently requires administrative assistance; automated email password resets are scheduled for a future milestone.
- **No Email Verification**: Accounts activate immediately upon registration without an email verification round-trip.
- **Notification Reminders are Preference-Only**: Reminders are recorded in the database, but outbound push/SMS dispatch requires an external background job worker.
- **AI Features are Optional & Inactive by Default**: Core cycle tracking, symptom logging, and reports function 100% offline without AI configuration or recurring API fees.
- **Ephemeral Storage Without S3**: Local filesystem uploads do not persist across serverless function lifecycles; durable file storage requires an S3-compatible bucket.
- **Serverless Execution Constraints**: Requests adhere to standard Vercel serverless execution limits (10-second request timeout).

---

## Documentation Index

- [ARCHITECTURE.md](ARCHITECTURE.md) — Comprehensive technical architecture and subsystem boundaries
- [SECURITY.md](SECURITY.md) — Security policy, cryptographic standards, and vulnerability disclosure
- [AUTHENTICATION.md](AUTHENTICATION.md) — Authentication architecture, session management, and credential flows
- [DATABASE.md](DATABASE.md) — Database schema, table relationships, and index design
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment guidelines and serverless configuration
- [BACKUP_RESTORE.md](BACKUP_RESTORE.md) — Disaster recovery runbooks and restore rehearsal procedures
- [OFFSITE_BACKUP.md](OFFSITE_BACKUP.md) — Encrypted offsite backup architecture and OneDrive sync
- [RUNBOOK.md](RUNBOOK.md) — Operational runbooks, incident response, and triage procedures
- [REAL_USER_LAUNCH_CHECKLIST.md](REAL_USER_LAUNCH_CHECKLIST.md) — Operational readiness and launch verification gates

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
