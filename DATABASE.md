# Evara Database Architecture & Migration Guide

This document describes the schema design, migration system, and maintenance instructions for the Evara database.

## 1. Schema Overview

The database uses standard MySQL 8.0+ syntax managed with Drizzle ORM:

- **`users`**:
  - `id`: Auto-increment integer primary key.
  - `openId`: Unique varchar identifier (retained for backward compatibility).
  - `email`: Normalized email address (indexed by `users_email_idx`).
  - `passwordHash`: Scrypt-hashed password (`salt:derivedKeyHex`).
  - `loginMethod`: Authentication method (`local` default).
  - `role`: Role (`user` or `admin`).
  - `createdAt`, `updatedAt`, `lastSignedIn`: Timestamps.

- **`sessions`**:
  - `id`: SHA-256 hash of the session token (64 hex characters primary key).
  - `userId`: Foreign key references `users(id)` with cascading delete.
  - `expiresAt`: Expiration timestamp (indexed).
  - `createdAt`: Creation timestamp.
  - `userAgent`, `ipAddress`: Client audit metadata.

- **`userProfiles`**:
  - User preferences, display name, typical cycle duration, and tracking goals.

- **`periodLogs`**:
  - `userId`: Owner foreign key.
  - `startDate`, `endDate`: ISO format calendar dates (`YYYY-MM-DD`).
  - `flowIntensity`: Enum (`light`, `medium`, `heavy`).
  - `notes`: User notes.
  - Unique constraint: `periodLogs_owner_start_unique` (`userId`, `startDate`).

- **`symptomLogs`**:
  - `userId`: Owner foreign key.
  - `logDate`, `symptom`, `severity` (`mild`, `moderate`, `severe`), `notes`.

- **`wellnessLogs`**:
  - `userId`: Owner foreign key.
  - `logDate`, `mood`, `energy`, `sleepHours`, `waterGlasses`, `activityMinutes`, `stress`, `pain`.
  - Unique constraint: (`userId`, `logDate`).

- **`reminders`**:
  - Private user reminder preferences (`reminderType`, `title`, `scheduleTime`, `scheduleFrequency`, `isEnabled`).

---

## 2. Migration System

All migrations are located in `drizzle/` and registered in `drizzle/meta/_journal.json`:

1. `0000_wild_krista_starr.sql`: Creates `users` table.
2. `0001_purple_tiger_shark.sql`: Creates `periodLogs`, `reminders`, `symptomLogs`, `userProfiles`, `wellnessLogs` tables.
3. `0002_workable_kree.sql`: Adds unique constraint on `periodLogs(userId, startDate)`.
4. `0003_add_local_auth_and_sessions.sql`: Adds `passwordHash` to `users`, creates `sessions` table, and adds foreign keys and indexes.

### Running Migrations

To apply pending migrations:

```bash
pnpm db:push
```

Or run via Drizzle Kit directly:

```bash
npx drizzle-kit migrate
```

---

## 3. Database Portability & Provider Switching

Evara is 100% compatible with standard MySQL. You can deploy it to:
- Self-hosted MySQL 8.0 on VPS / Docker
- TiDB Cloud (Serverless MySQL)
- PlanetScale / Aiven / DigitalOcean Managed MySQL
- Amazon RDS / Aurora MySQL

To move databases between providers:
1. Export existing data:
   ```bash
   mysqldump -u <user> -p<pass> -h <source-host> evara > evara_backup.sql
   ```
2. Import into new provider:
   ```bash
   mysql -u <user> -p<pass> -h <target-host> evara < evara_backup.sql
   ```
3. Update `DATABASE_URL` in `.env` and restart the application.
