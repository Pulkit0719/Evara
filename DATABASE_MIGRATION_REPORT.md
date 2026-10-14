# Database Migration & Data Integrity Report — Evara

This report documents the database architecture, schema migrations, and relational integrity guarantees ensuring that all existing user accounts, profiles, period logs, symptoms, wellness records, and reminders are 100% preserved without data loss or corruption.

---

## 1. Schema Inventory & Relationship Graph

Evara's database is modeled using **Drizzle ORM** with MySQL / TiDB compatibility.

### Relational Entity Graph:
```text
users (id PRIMARY KEY, openId UNIQUE, email, passwordHash, role, loginMethod, lastSignedIn, createdAt, updatedAt)
  │
  ├── userProfiles (userId FK -> users.id, displayName, typicalCycleLength, typicalPeriodDuration, trackingGoals)
  ├── periodLogs (userId FK -> users.id, startDate, endDate, flowIntensity, notes)
  ├── symptomLogs (userId FK -> users.id, logDate, symptom, severity, notes)
  ├── wellnessLogs (userId FK -> users.id, logDate, mood, energy, sleepHours, waterGlasses, activityMinutes, stress, pain)
  ├── reminders (userId FK -> users.id, reminderType, title, scheduleTime, scheduleFrequency, isEnabled)
  └── sessions (userId FK -> users.id, id PRIMARY KEY, expiresAt, userAgent, ipAddress, createdAt)
```

### Table Definitions & Constraints:

| Table Name | Primary Key | Foreign Keys | Unique Constraints & Indexes | Purpose |
|---|---|---|---|---|
| `users` | `id` (int AUTO_INCREMENT) | None | `openId` (UNIQUE), `email` (INDEX) | User accounts & credentials |
| `userProfiles` | `id` (int AUTO_INCREMENT) | `userId` → `users.id` (CASCADE) | `userId` (UNIQUE) | Onboarding preferences & cycle defaults |
| `periodLogs` | `id` (int AUTO_INCREMENT) | `userId` → `users.id` (CASCADE) | `(userId, startDate)` (UNIQUE + INDEX) | Tracked menstrual period flow dates |
| `symptomLogs` | `id` (int AUTO_INCREMENT) | `userId` → `users.id` (CASCADE) | `(userId, logDate)` (INDEX) | Daily symptom records with severity |
| `wellnessLogs` | `id` (int AUTO_INCREMENT) | `userId` → `users.id` (CASCADE) | `(userId, logDate)` (UNIQUE) | Check-ins for sleep, mood, hydration, stress |
| `reminders` | `id` (int AUTO_INCREMENT) | `userId` → `users.id` (CASCADE) | `userId` (INDEX) | User reminders and discreet preview copy |
| `sessions` | `id` (varchar(64)) | `userId` → `users.id` (CASCADE) | `userId` (INDEX), `expiresAt` (INDEX) | Revocable server-side login sessions |

---

## 2. Migration History

| Version | Migration File | Changes | Mode |
|---|---|---|---|
| `0000` | `drizzle/0000_wild_krista_starr.sql` | Initial `users` table created with `openId`. | Baseline |
| `0001` | `drizzle/0001_purple_tiger_shark.sql` | Added `userProfiles`, `periodLogs`, `symptomLogs`, `wellnessLogs`, `reminders`. | Additive |
| `0002` | `drizzle/0002_workable_kree.sql` | Added unique constraint on `periodLogs(userId, startDate)` to prevent duplicate starts. | Constraint |
| `0003` | `drizzle/0003_add_local_auth_and_sessions.sql` | Added `passwordHash` column to `users`, added `sessions` table. | Additive (Manus Independence) |

---

## 3. Data Integrity & Safety Guarantees

1. **Purely Additive**: Migration `0003` did not drop any tables, remove any columns, or alter existing data types.
2. **Nullable Password Hash**: Existing legacy users have `passwordHash = NULL`. They are not locked out or deleted.
3. **Foreign Key Integrity**: All dependent child tables use `ON DELETE CASCADE` referencing `users.id`. Because `users.id` is never changed or recreated during migration, foreign keys remain 100% valid.
4. **Scoping**: All queries in `server/db.ts` filter strictly by `userId = ctx.user.id`, ensuring zero cross-tenant data leakage.
