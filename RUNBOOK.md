# Evara Production Runbook

This runbook provides complete operational procedures for deploying, managing, maintaining, and troubleshooting **Evara** in production under **100% self-hosted or zero-cost cloud infrastructure**.

---

## 1. Quick Reference & Health Probes

| Probe / Action | URL / Command | Expected Response |
|---|---|---|
| **Liveness Check** | `GET /healthz` | `{"status":"ok","timestamp":"..."}` (HTTP 200) |
| **Readiness Check** | `GET /readyz` | `{"status":"ready","database":"connected","timestamp":"..."}` (HTTP 200) |
| **Degraded State** | `GET /readyz` | `{"status":"degraded"|"error","database":"disconnected",...}` (HTTP 503) |
| **App Entrypoint** | `GET /` | Returns HTML, static assets, and initializes React shell |
| **API Endpoint** | `POST /api/trpc/*` | tRPC batch/procedure handler with CSRF origin validation |

---

## 2. Infrastructure Architecture & Deployment Matrix

```text
                                  ┌───────────────────────────┐
                                  │      Client Browser       │
                                  └─────────────┬─────────────┘
                                                │ HTTPS (TLS 1.3)
                                                ▼
                                  ┌───────────────────────────┐
                                  │   Reverse Proxy / Edge    │
                                  │ (Render / Cloudflare / Nginx)│
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │     Evara Express App (Node 20)  │
                               │  - Security Headers (HSTS, etc.)│
                               │  - CSRF / Origin Guard          │
                               │  - First-Party Cookie Auth      │
                               │  - tRPC API Router              │
                               │  - Static Asset Serving (Vite)  │
                               └───────┬──────────────┬──────────┘
                                       │              │
                   MySQL / SSL (Port 4000/3306)       │ S3 Protocol / Local FS
                                       ▼              ▼
                         ┌──────────────────┐   ┌──────────────────┐
                         │   TiDB Cloud /   │   │  Local Disk or   │
                         │   MySQL 8.0 DB   │   │  Cloudflare R2   │
                         └──────────────────┘   └──────────────────┘
```

---

## 3. Step-by-Step Production Deployment

### Option A: Render Web Service (Recommended Zero-Cost Cloud Setup)

1. **Prerequisites**:
   - GitHub account with repository: `https://github.com/Pulkit0719/Evara`
   - TiDB Cloud Serverless account (free 5GB MySQL database at [https://tidbcloud.com](https://tidbcloud.com))
2. **Database Provisioning**:
   - Create a TiDB Serverless cluster in your preferred region.
   - Obtain connection string:
     ```text
     mysql://<user>:<password>@<host>:4000/evara?ssl={"rejectUnauthorized":true}
     ```
3. **Run Initial Database Migration**:
   From your local administrative terminal:
   ```bash
   DATABASE_URL="<your-tidb-connection-string>" pnpm db:push
   ```
4. **Deploy Web Service on Render**:
   - Sign in to [https://render.com](https://render.com).
   - Click **New +** → **Web Service** → Connect `Pulkit0719/Evara`.
   - Settings:
     - **Name**: `evara`
     - **Region**: Same or closest to your TiDB cluster region.
     - **Branch**: `main`
     - **Runtime**: `Node`
     - **Build Command**: `pnpm install --frozen-lockfile && pnpm build`
     - **Start Command**: `pnpm start`
     - **Instance Type**: `Free` (512MB RAM, shared CPU)
   - Add Environment Variables:
     ```env
     NODE_ENV=production
     PORT=3000
     DATABASE_URL=<your-tidb-connection-string>
     SESSION_SECRET=<generate-via-openssl-rand-hex-32>
     OWNER_EMAIL=<your-admin-email>
     AI_PROVIDER=gemini
     AI_API_KEY=<optional-gemini-free-api-key>
     ```
   - Click **Create Web Service**.
5. **Verify Deployment**:
   - Monitor the build logs until `Server running on http://localhost:3000/` appears.
   - Access `https://evara.onrender.com/healthz` (200 OK).
   - Access `https://evara.onrender.com/readyz` (200 OK, database connected).
   - Open `https://evara.onrender.com` in your browser. Register your administrative account.

---

### Option B: Local / Self-Hosted Docker Compose

To run Evara entirely on your own infrastructure with zero cloud dependencies:

```bash
# 1. Clone repository
git clone https://github.com/Pulkit0719/Evara.git
cd Evara

# 2. Configure environment
cp .env.example .env
# Edit .env with your desired SESSION_SECRET and configuration

# 3. Build and launch container stack
docker compose up -d --build

# 4. Check container health
docker compose ps
docker compose logs -f app
```

The application is immediately available at `http://localhost:3000`.

---

## 4. Operational Procedures

### A. Database Backup (Daily Routine)

Execute consistent single-transaction backups without downtime:

```bash
# Cloud TiDB / Managed MySQL
mysqldump \
  --single-transaction \
  --quick \
  --triggers \
  --routines \
  -h <host> \
  -P 4000 \
  -u <user> \
  -p \
  evara > backup_evara_$(date +%Y%m%d_%H%M%S).sql

# Docker Compose Local MySQL
docker exec -i evara_mysql mysqldump -u root -proot_password --single-transaction evara_db > backup_evara_$(date +%Y%m%d_%H%M%S).sql
```

### B. Database Restoration

In case of data recovery or migration to a new host:

```bash
# Cloud TiDB / Remote MySQL
mysql -h <host> -P 4000 -u <user> -p evara < backup_evara_YYYYMMDD_HHMMSS.sql

# Docker Compose Local MySQL
docker exec -i evara_mysql mysql -u root -proot_password evara_db < backup_evara_YYYYMMDD_HHMMSS.sql
```

### C. Rolling Back an Application Deployment

1. **Instant Application Rollback**:
   In Render dashboard, click **Deploys** → select the previously successful deployment commit → click **Rollback to this deploy**.
2. **Git Rollback**:
   ```bash
   git revert HEAD
   git push origin main
   ```
   Render/CI will automatically rebuild and deploy the prior stable commit.
3. **Database Schema Rollback**:
   If a migration needs reversion:
   - Restore database from the pre-deployment snapshot created in Step A.

### D. Rotating Secrets

1. **Session Secret Rotation (`SESSION_SECRET`)**:
   - Generate a new 64-character hex secret: `openssl rand -hex 32`.
   - Update `SESSION_SECRET` in provider dashboard.
   - Trigger a service redeployment.
   - *Impact*: Active sessions will expire cleanly, requiring users to log in again. No user records or health data are lost.
2. **Database Password Rotation**:
   - Update user password in MySQL/TiDB.
   - Update `DATABASE_URL` in environment configuration.
   - Redeploy service.

---

## 5. Security & Isolation Invariants

1. **Row-Level Tenant Isolation**:
   Every database query in `server/db.ts` filters explicitly by `eq(table.userId, ctx.user.id)`. Cross-user data access is impossible at the query level.
2. **Authentication Security**:
   - Passwords hashed with Node.js crypto `scrypt` (N=16384, r=8, p=1, 64-byte key).
   - Session tokens hashed with SHA-256 before database persistence. Raw tokens exist only in client HttpOnly cookies.
   - Cookies configured with `HttpOnly: true`, `SameSite: "lax"`, and `Secure: true` in production.
3. **CSRF & Origin Guard**:
   All state-changing endpoints under `/api` validate the `Origin` header against `Host`. Cross-origin requests are blocked with HTTP 403.
4. **Security Headers**:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
   - `X-XSS-Protection: 1; mode=block`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 6. Incident Response Playbooks

### Incident 1: `/readyz` Returns HTTP 503 (Database Disconnected)
- **Symptom**: Application displays connection errors or `/readyz` probe fails.
- **Check**:
  1. Inspect application logs for connection timeouts or SSL handshake errors.
  2. Test database connection directly using MySQL CLI from an authorized network.
  3. Verify connection pool limits or TiDB Serverless Request Unit quotas.
  4. If paused due to idle, the serverless database will automatically wake within seconds.

### Incident 2: Free AI Quota Depleted (HTTP 429)
- **Symptom**: AI summary or insights indicate quota reached.
- **Behavior**: Evara's built-in fail-safe catches HTTP 429 and displays a helpful message. The rest of the application (cycles, symptoms, wellness logs, reminders, reports) continues to operate with 100% functionality. Zero billing occurs.
- **Resolution**:
  - Wait for quota reset (e.g., daily reset at midnight UTC).
  - Or switch to local Ollama (`AI_PROVIDER=ollama`) for unlimited offline inference.
