# Evara Deployment Guide

Evara is designed for independent deployment on any standard Node.js runtime or container host.

## Recommended Architecture

```text
[ GitHub Repository ]
        │
        ▼ (Git Push / Webhook)
[ Host / Container Platform ] (Docker, VPS, Render, Railway, Fly.io)
        │
        ├── Node.js / Express Application (Port 3000)
        │     └── Serves Vite Client & tRPC API (Same-Origin)
        │
        ├── MySQL Database (Docker MySQL 8.0, TiDB Cloud, or Managed DB)
        │
        └── (Optional) S3-Compatible Storage (MinIO, Cloudflare R2, AWS S3)
```

---

## Deployment Options

### Option 1: Docker / Docker Compose (Recommended)

1. Clone repository to server:
   ```bash
   git clone <repo-url> /opt/evara
   cd /opt/evara
   ```
2. Configure `.env`:
   ```bash
   cp .env.example .env
   # Update DATABASE_URL and SESSION_SECRET
   ```
3. Launch container stack:
   ```bash
   docker compose up -d --build
   ```

### Option 2: Linux VPS / Systemd (Ubuntu/Debian)

1. Install Node.js 20 and pnpm:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo corepack enable
   ```
2. Build application:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   pnpm db:push
   ```
3. Run under systemd service or PM2:
   ```bash
   pm2 start dist/index.js --name evara
   ```

### Option 3: Cloud Platforms (Railway, Render, Fly.io)

1. Link your personal GitHub repository.
2. Build command:
   ```bash
   pnpm install && pnpm build && pnpm db:push
   ```
3. Start command:
   ```bash
   pnpm start
   ```
4. Configure environment variables in platform dashboard (`DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`).

---

## Health Checks

- **Liveness Probe**: `GET /healthz` (returns 200 `{ status: "ok" }`).
- **Readiness Probe**: `GET /readyz` (executes `SELECT 1` on MySQL, returns 200 `{ status: "ready", database: "connected" }`).
