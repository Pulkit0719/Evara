# Evara Setup & Installation Guide

This guide provides step-by-step instructions for running Evara locally or in containerized environments.

## System Prerequisites

- **Node.js**: Version 20.x or higher
- **pnpm**: Version 10.x (`corepack enable && corepack prepare pnpm@10.4.1 --activate`)
- **Database**: MySQL 8.0+, TiDB, PlanetScale, or Docker MySQL container
- **OS**: Windows, macOS, or Linux

---

## Local Development Setup

### 1. Repository Setup

```bash
git clone <your-github-repo-url>
cd evara-project-extracted
pnpm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set the required environment variables:

```env
DATABASE_URL=mysql://root:password@127.0.0.1:3306/evara
SESSION_SECRET=a-secure-random-32-char-string-for-session-signing
```

To generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Database Migration

Ensure your MySQL server is running, then run the migration command:

```bash
pnpm db:push
```

This applies migrations `0000` through `0003` to your database, creating all required tables and indexes.

### 4. Start Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000` in your browser.

---

## Verification Commands

To verify your installation:

```bash
# Check TypeScript types
pnpm check

# Run test suite
pnpm test

# Build production bundle
pnpm build
```
