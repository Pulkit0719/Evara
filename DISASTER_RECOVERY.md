# Evara Disaster Recovery & Business Continuity Plan

This plan establishes procedures for restoring Evara and its user health records in the event of major infrastructure failures, host outages, database corruption, or credential compromises.

---

## 1. Objectives & Metrics

| Metric | Target | Rationale |
|---|---|---|
| **Recovery Point Objective (RPO)** | **< 24 Hours** (Daily Backups)<br>*< 1 Hour* if automated cron snapshots enabled | Maximum acceptable data loss window in disaster scenario |
| **Recovery Time Objective (RTO)** | **< 15 Minutes** | Time required to provision an alternative host and restore service |
| **Vendor Independence** | **100% Zero Lock-In** | Can be deployed to any Docker, Node.js, or MySQL provider without code changes |

---

## 2. Disaster Scenarios & Playbooks

### Scenario A: Hosting Provider Outage (e.g., Render Is Down)

Because Evara is a portable Express + Vite application with zero proprietary platform bindings, you can immediately redeploy to an alternate host:

1. **Option 1: Deploy to Koyeb / Railway**:
   - Create a Web Service pointing to `https://github.com/Pulkit0719/Evara`.
   - Provide the same environment variables (`DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`).
   - The app is online within 3 minutes.
2. **Option 2: Deploy to Local Hardware or VPS via Docker**:
   ```bash
   git clone https://github.com/Pulkit0719/Evara.git
   cd Evara
   docker compose up -d --build
   ```
3. **DNS Cutover**:
   Update your domain DNS (e.g., in Cloudflare) to point to the new IP/subdomain.

---

### Scenario B: Database Failure or Data Corruption

1. **Assess Impact**:
   Verify `/readyz` endpoint output and database server error logs.
2. **Identify Latest Clean Backup**:
   Locate the most recent `backup_evara_YYYYMMDD_HHMMSS.sql` snapshot.
3. **Provision Fresh Database (If Cloud Cluster Lost)**:
   - Create a new free cluster on TiDB Cloud Serverless or local MySQL 8.0.
4. **Restore Database Schema & Data**:
   ```bash
   mysql -h <new_host> -P <port> -u <user> -p <database_name> < backup_evara_LATEST.sql
   ```
5. **Verify Table Integrity**:
   Run the integrity query from `BACKUP_AND_RECOVERY.md`:
   ```sql
   SELECT 'users' AS table_name, COUNT(*) AS rows FROM users
   UNION ALL
   SELECT 'userProfiles', COUNT(*) FROM userProfiles
   UNION ALL
   SELECT 'periodLogs', COUNT(*) FROM periodLogs
   UNION ALL
   SELECT 'symptomLogs', COUNT(*) FROM symptomLogs
   UNION ALL
   SELECT 'wellnessLogs', COUNT(*) FROM wellnessLogs
   UNION ALL
   SELECT 'reminders', COUNT(*) FROM reminders;
   ```
6. **Update Application Environment**:
   Update `DATABASE_URL` in your hosting dashboard and trigger a redeployment.

---

### Scenario C: Compromised Secret or Credential Leak

If an administrative key or secret is leaked:

1. **Session Secret (`SESSION_SECRET`)**:
   - Generate new random string: `openssl rand -hex 32`
   - Update in hosting environment variables.
   - Restart service.
   - *Result*: All active attacker sessions are immediately invalidated.
2. **Database Credentials (`DATABASE_URL`)**:
   - Log into TiDB/MySQL administrative console.
   - Change user password: `ALTER USER 'evara_user'@'%' IDENTIFIED BY 'new_strong_password';`
   - Update `DATABASE_URL` in hosting provider and restart.
3. **AI / S3 API Keys**:
   - Revoke compromised keys in Google AI Studio or Cloudflare R2 dashboard.
   - Generate new keys and update corresponding environment variables.

---

### Scenario D: Cold Start & Inactivity Sleep Mitigation

When running on Render Free Tier, services spin down after 15 minutes of inactivity:

1. **Normal Behavior**:
   - First request after sleep takes ~30–50 seconds to boot the container.
   - Subsequent requests respond in <50ms.
2. **Optional Zero-Cost Keep-Alive**:
   - You can configure a free uptime monitor (e.g., [Cron-Job.org](https://cron-job.org), [UptimeRobot](https://uptimerobot.com), or GitHub Actions scheduled workflow) to send a `GET /healthz` request every 14 minutes.
   - *Result*: Keeps container awake with 100% free requests without incurring charges.

---

## 3. Data Integrity Verification Matrix

| Table | Integrity Verification Metric | Reversible? |
|---|---|---|
| `users` | Primary key `id`, unique `openId`, hashed `passwordHash` | Yes |
| `userProfiles` | Foreign key `userId` references `users.id` | Yes |
| `periodLogs` | Unique constraint on `(userId, startDate)` | Yes |
| `symptomLogs` | Indexed on `(userId, logDate)` | Yes |
| `wellnessLogs` | Unique constraint on `(userId, logDate)` | Yes |
| `reminders` | User-scoped notification rules | Yes |
| `sessions` | SHA-256 hashed token IDs with expiration dates | Yes |
