# Zero-Cost (₹0) Deployment Guide — Evara

This guide explains how to deploy Evara entirely for **₹0 / $0 monthly cost** using generous, permanent free tiers with **no credit card requirements, no auto-billing risk, and no vendor lock-in**.

---

## 1. Zero-Cost Infrastructure Architecture

```text
User Browser
     │
     └── [Unified Full-Stack App] ──> Free Container / Node.js Web Service (Render Free / Koyeb / Docker)
                                           │
                                           ├── Database: TiDB Serverless (Free: 5GB, MySQL compatible)
                                           │
                                           ├── Storage:  Local Encrypted Disk OR Cloudflare R2 (Free: 10GB)
                                           │
                                           └── AI:       Google Gemini Free Tier / Groq Free / Local Ollama
```

---

## 2. Step 1: Free Database Setup (TiDB Serverless)

**Provider**: PingCAP TiDB Cloud Serverless  
**Cost**: **₹0 forever** (No credit card required)  
**Free Tier**: 5 GB row storage, 50 million Request Units per month.

1. Sign up at [https://tidbcloud.com](https://tidbcloud.com) with GitHub or Google (no credit card required).
2. Click **Create Cluster** and select **Serverless**.
3. Choose your nearest region (e.g. `AWS us-east-1` or `AWS ap-south-1`).
4. Click **Connect** and select **Connect with General Client** (MySQL).
5. Copy your connection string:
   ```text
   mysql://<username>:<password>@<gateway-host>:4000/evara?ssl={"rejectUnauthorized":true}
   ```
6. Test pushing the schema from your local terminal:
   ```bash
   DATABASE_URL="<your-tidb-connection-string>" pnpm db:push
   ```

---

## 3. Step 2: Free AI Setup (Google Gemini Free Tier or Groq)

### Option A: Google Gemini Free Tier (Recommended)
**Provider**: Google AI Studio  
**Cost**: **₹0** (No credit card required)  
**Free Tier**: 15 Requests Per Minute, 1,500 Requests Per Day.

1. Go to [https://aistudio.google.com](https://aistudio.google.com).
2. Click **Get API key** → **Create API key**.
3. Copy your API key.
4. Set in your environment:
   ```env
   AI_PROVIDER=gemini
   AI_API_KEY=AIzaSy...
   AI_MODEL=gemini-1.5-flash
   ```

### Option B: Local Ollama (100% Free / Offline)
**Cost**: **₹0** (Runs on your machine, zero network requests)
```env
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3.2
```

---

## 4. Step 3: Free Object Storage (Local Disk or Cloudflare R2)

### Option A: Local Disk Fallback (Easiest)
Leave S3 environment variables blank. Evara automatically stores uploaded files in `.storage/uploads/` on the server and serves them via `/api/storage/*` with authenticated ownership checks. Cost: **₹0**.

### Option B: Cloudflare R2
**Provider**: Cloudflare  
**Cost**: **₹0**  
**Free Tier**: 10 GB storage, 10M read ops, 1M write ops, **zero egress bandwidth fees**.

1. Create a free Cloudflare account at [https://cloudflare.com](https://cloudflare.com).
2. Navigate to **R2** → **Create Bucket** → Name it `evara-storage`.
3. In **R2 Manage API Tokens**, create a token with `Object Read & Write` permissions.
4. Set in your environment:
   ```env
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=evara-storage
   S3_ACCESS_KEY_ID=<r2-access-key-id>
   S3_SECRET_ACCESS_KEY=<r2-secret-access-key>
   ```

---

## 5. Step 4: Backend Deployment (Render Free Web Service / Koyeb)

### Option A: Deploying on Render (Free Tier)
**Cost**: **₹0** (750 free compute hours/month)

1. Create a free account at [https://render.com](https://render.com).
2. Connect your GitHub repository: `https://github.com/Pulkit0719/Evara`.
3. Click **New** → **Web Service**.
4. Configure:
   - **Environment**: `Node`
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start`
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add:
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=<your-tidb-connection-string>
   SESSION_SECRET=<random-32-char-string>
   AI_PROVIDER=gemini
   AI_API_KEY=<your-gemini-key>
   ```
6. Click **Deploy Web Service**. You will receive a free HTTPS URL: `https://evara.onrender.com`.

---

## 6. Step 5: Verification & Health Checks

Once deployed, verify that all endpoints respond properly:

```bash
# 1. Liveness check
curl https://your-backend.onrender.com/healthz
# Returns: {"status":"ok","timestamp":"..."}

# 2. Readiness check (verifies database connectivity)
curl https://your-backend.onrender.com/readyz
# Returns: {"status":"ready","database":"connected","timestamp":"..."}
```

---

## 7. Zero-Cost Protection Guarantee

1. **No Overages**: Free tiers on TiDB Serverless, Render, and Google Gemini simply throttle or return HTTP 429 when quota is reached—they **never auto-upgrade to paid plans**.
2. **Application Quota Guard**: Evara includes an internal daily rate limiter (`server/services/ai.ts`) that catches 429 errors and displays a friendly notice rather than failing or billing.
