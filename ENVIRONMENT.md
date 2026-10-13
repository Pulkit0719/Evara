# Evara Environment Configuration Reference

This document details all supported environment variables in Evara.

## Variable Reference

### Application Settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Optional | `development` | Set to `production` in live deployments. |
| `PORT` | Optional | `3000` | Port for the HTTP server to listen on. |
| `APP_URL` | Optional | `http://localhost:3000` | Base public URL of the deployed application. |
| `VITE_APP_ID` | Optional | `evara` | Application identifier. |
| `VITE_APP_TITLE`| Optional | `Evara` | Application page title prefix. |

---

### Database Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | None | MySQL connection string (`mysql://user:pass@host:port/dbname`). |

---

### Authentication Settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | **Yes** (Prod) | Hardcoded Dev Key | 32+ character random secret used for cookie signing and session protection. |

---

### Administrative Settings (Optional)

| Variable | Required | Default | Description |
|---|---|---|---|
| `OWNER_EMAIL` | Optional | None | Email address automatically granted `admin` role upon registration/login. |
| `OWNER_USER_ID`| Optional | None | Numeric user ID granted `admin` role. |

---

### AI Service Adapter (Optional)

Evara functions completely with AI unconfigured. When configured, it uses standard OpenAI-compatible endpoints:

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | Optional | `gemini` | `gemini`, `groq`, `ollama`, or `openai`. |
| `AI_BASE_URL` | Optional | Provider URL | Custom API endpoint. Default depends on `AI_PROVIDER`. |
| `AI_API_KEY` | Optional | None | API key for Gemini, Groq, or OpenAI. (Not needed for Ollama). |
| `AI_MODEL` | Optional | Provider Default | Model name (e.g. `gemini-1.5-flash`, `llama-3.3-70b-versatile`). |

---

### Object Storage (Optional)

When unconfigured, uploads fall back to local disk storage (`.storage/uploads`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `S3_ENDPOINT` | Optional | None | Custom S3 endpoint URL (e.g. MinIO or Cloudflare R2). |
| `S3_REGION` | Optional | `us-east-1` | S3 bucket region. |
| `S3_BUCKET` | Optional | None | S3 bucket name. |
| `S3_ACCESS_KEY_ID` | Optional | None | AWS / S3 access key ID. |
| `S3_SECRET_ACCESS_KEY` | Optional | None | AWS / S3 secret access key. |

---

### Email Configuration (Optional / SMTP)

When unconfigured, emails log to the server console:

| Variable | Required | Default | Description |
|---|---|---|---|
| `EMAIL_PROVIDER` | Optional | `smtp` | Mail provider abstraction. |
| `SMTP_HOST` | Optional | None | SMTP server hostname. |
| `SMTP_PORT` | Optional | `587` | SMTP port (typically 587 or 465). |
| `SMTP_USER` | Optional | None | SMTP username. |
| `SMTP_PASSWORD` | Optional | None | SMTP password. |
| `EMAIL_FROM` | Optional | `noreply@evara.app`| Default sender email address. |

---

### Webhooks (Optional)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NOTIFICATION_WEBHOOK_URL` | Optional | None | HTTPS webhook URL for admin notifications. |
