# Evara System Architecture

This document describes the architectural design, component boundaries, and security model of Evara.

## 1. Architectural Principles

1. **Self-Contained & Self-Hosted**: No dependency on external proprietary runtimes, proprietary auth providers, or hidden vendor APIs.
2. **Unified Single-Origin Deployment**: The frontend and backend run under the same origin (Express serves both Vite static assets and the `/api/trpc` endpoint), eliminating cross-origin complexity and third-party cookie issues.
3. **Fail-Closed Security**: Authentication, session persistence, and authorization fail closed.
4. **Data Privacy First**: User health data (periods, symptoms, wellness entries) is strictly scoped to the authenticated user ID at the query level.

## 2. Component Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│  - React 19 + TypeScript + Tailwind CSS                     │
│  - Wouter Client-Side Router                                │
│  - TanStack React Query + tRPC Client                       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / HTTPS (Same-Origin)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express HTTP Server                      │
│                                                             │
│  [Middlewares]                                              │
│  ├─ Production Security Headers (CSP, HSTS, X-Frame, etc.)  │
│  ├─ Origin CSRF Validation for State-Changing Methods       │
│  └─ JSON / URL-encoded Parsers                              │
│                                                             │
│  [Probes & Handlers]                                        │
│  ├─ GET /healthz  -> Liveness (Process is running)          │
│  ├─ GET /readyz   -> Readiness (Runs SELECT 1 on DB)        │
│  ├─ GET /api/storage/* -> Authenticated Storage Proxy       │
│  └─ /api/trpc/*   -> tRPC Middleware & Router Stack         │
│                                                             │
│  [tRPC Context & Security Gate]                             │
│  ├─ createContext -> authenticateRequest()                  │
│  ├─ publicProcedure -> unauthenticated routes               │
│  ├─ protectedProcedure -> enforces ctx.user != null         │
│  └─ adminProcedure -> enforces ctx.user.role == 'admin'     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data & Storage Layer                     │
│                                                             │
│  [Database] MySQL 8.0+ / TiDB (via Drizzle ORM)             │
│  ├─ users (identity, role, scrypt passwordHash)             │
│  ├─ sessions (SHA-256 hashed session token, expiration)     │
│  ├─ userProfiles, periodLogs, symptomLogs, wellnessLogs     │
│  └─ reminders                                               │
│                                                             │
│  [Storage] S3-Compatible OR Local Fallback                  │
│  └─ AWS S3 / Cloudflare R2 / MinIO / Local Disk             │
└─────────────────────────────────────────────────────────────┘
```

## 3. Request Lifecycle

1. **Incoming Request**: Express receives the HTTP request and validates security headers.
2. **Origin Verification**: If the request method is state-changing (`POST`, `PUT`, `DELETE`), Express verifies that the `Origin` header matches `Host`.
3. **Session Authentication**: For tRPC procedures, `createContext` reads the HttpOnly cookie `app_session_id`. The token is SHA-256 hashed and looked up in the `sessions` table. If expired, it is deleted and treated as unauthenticated.
4. **Authorization**: `protectedProcedure` verifies the presence of `ctx.user`. Every database helper receives only `ctx.user.id`.
5. **Database Scoping**: Database queries apply `where(eq(table.userId, ctx.user.id))` to ensure complete cross-user data isolation.
