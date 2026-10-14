# Evara Deployment Guide

Evara is designed for independent, production deployment with zero platform vendor lock-in. It is fully adapted for deployment on **Vercel** with **TiDB Cloud Serverless (MySQL 8.0)**, as well as Docker, VPS, or any standard container runtime.

---

## Production Deployment: Vercel + TiDB Cloud

### 1. Architecture

```text
[ User Browser ]
       │ HTTPS
       ▼
[ Vercel Global Edge Network ]
  ├── Static Assets (SPA) ──► dist/public (CDN Edge Caching)
  └── API & Health Routes  ──► api/index.js (Node.js 22 Serverless Function)
                                   │
                                   ├── Express Middleware & tRPC Router
                                   ├── Security Headers & Same-Origin CSRF
                                   ├── Scrypt Authentication & Revocable Sessions
                                   │ TLS 1.3
                                   ▼
                       [ TiDB Cloud Serverless ]
                       (Tokyo AWS / MySQL 8.0 Compatible)
                       Database: `evara`
```

### 2. Live Production Endpoints

- **Live URL**: `https://evara-gray.vercel.app`
- **Liveness Probe**: `GET https://evara-gray.vercel.app/healthz` (200 OK)
- **Readiness Probe**: `GET https://evara-gray.vercel.app/readyz` (200 OK, executes `SELECT 1` on TiDB)
- **tRPC API Root**: `https://evara-gray.vercel.app/api/trpc`

### 3. Vercel Configuration Settings

In **Vercel → Project → Settings**:

- **Framework Preset**: `Other`
- **Root Directory**: `./`
- **Build Command**: `pnpm build`
- **Output Directory**: `dist/public`
- **Node.js Version**: `22.x`

#### Environment Variables (Production Scope)

| Name | Type | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | Plaintext | Set to `production`. Enables HSTS and secure cookie policies. |
| `DATABASE_URL` | Secret | TiDB Cloud TLS connection string (`mysql://user:pass@host:4000/evara?ssl={"rejectUnauthorized":true}`) |
| `SESSION_SECRET` | Secret | Cryptographically secure 32-byte (64-character hex) random key. |

*Note: Do NOT configure `PORT` in Vercel. Vercel automatically manages edge listeners.*

---

## Alternative Deployment Options

### Option 2: Docker / Container Runtime

1. Clone repository:
   ```bash
   git clone https://github.com/Pulkit0719/Evara.git /opt/evara
   cd /opt/evara
   ```
2. Configure `.env`:
   ```bash
   cp .env.example .env
   # Set DATABASE_URL and SESSION_SECRET
   ```
3. Run container stack:
   ```bash
   docker compose up -d --build
   ```

### Option 3: Standalone Linux VPS / PM2

1. Install Node.js 22 and pnpm:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo corepack enable
   ```
2. Build and run:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   NODE_ENV=production node dist/index.js
   ```

---

## Health Checks & Monitoring

- `/healthz`: Liveness check verifying the HTTP process/function is active.
- `/readyz`: Readiness check verifying live end-to-end database connectivity via SQL probe.
