# Evara

An independent, private, self-hosted full-stack application designed for menstrual cycle tracking, symptom logging, and everyday wellness insights.

Evara is built from the ground up to operate with zero vendor lock-in. It functions with local email and password authentication, server-revocable database sessions, deterministic additive database migrations, optional S3-compatible object storage, provider-agnostic AI adapters, and same-origin deployment support.

---

## Features

- **Cycle Tracking**: Log periods, track flow intensity, record cycle history, and calculate average cycle lengths with data-driven estimates.
- **Interactive Calendar**: Monthly cycle overview with recorded periods, estimated windows, daily symptoms, and wellness check-in markers.
- **Symptom & Wellness Logs**: Record symptoms with severity rankings (mild, moderate, severe), daily mood, energy, sleep hours, water intake, activity, and stress.
- **Private Insights**: Identify personal trends in symptoms, mood, and sleep across cycle phases without predictive or diagnostic medical claims.
- **Doctor-Ready Summaries & Data Export**: Generate printable summaries and export health records on demand in clean JSON format.
- **Local & Independent Authentication**: Email and password authentication with `scrypt` hashing, SHA-256 hashed session persistence, server-side session revocation, rate-limiting, and secured legacy account migration.
- **Optional S3-Compatible Storage**: Uploads supported via AWS S3, Cloudflare R2, MinIO, or local filesystem fallback with strict user authorization.
- **Optional Universal AI Service Adapter**: Provider-agnostic completions compatible with Google Gemini Free Tier, Groq Developer Free Tier, Local Ollama, or OpenAI-compatible endpoints. The application functions completely without AI configured.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Lucide Icons, Wouter, TanStack Query |
| **Backend** | Node.js, Express, tRPC (v11), Zod |
| **Database & ORM** | MySQL 8.0+ / TiDB compatible, Drizzle ORM, Drizzle Kit |
| **Authentication** | Node built-in `crypto.scrypt`, SHA-256 hashed database sessions, HttpOnly cookies |
| **Object Storage** | AWS SDK v3 (`@aws-sdk/client-s3`), local filesystem fallback with user ownership scoping |
| **AI Integration** | Provider-agnostic OpenAI-compatible adapter (Gemini, Groq, Ollama, OpenAI) |
| **Testing** | Vitest (unit, security, accessibility, responsive, ownership) |

---

## Architecture

Evara uses a unified single-origin architecture:

```text
[ Browser Client ]
        │
        │ HTTP / HTTPS (Same-Origin)
        ▼
[ Express Server ] ── (Security Headers, Origin CSRF Check)
   ├── /healthz & /readyz  (Liveness & Database Probes)
   ├── /api/storage/*      (Authenticated & User-Scoped Asset Proxy)
   └── /api/trpc/*         (tRPC v11 Type-Safe API Procedures)
        │
        ├── Context: authenticateRequest (Validates SHA-256 Hashed Session)
        ├── Protected Procedures: Enforce ctx.user.id Ownership Filter
        └── Database Access: Drizzle ORM
                 │
                 ▼
     [ MySQL-Compatible Database ]
       ├── users (local credentials & legacy identity)
       ├── sessions (revocable session tokens)
       ├── userProfiles, periodLogs, symptomLogs, wellnessLogs, reminders
```

---

## Project Structure

```text
├── client/                     # Frontend client source
│   ├── public/                 # Static assets
│   └── src/
│       ├── _core/              # Core client hooks (useAuth)
│       ├── components/         # Reusable UI & domain components
│       │   └── ui/             # Radix & Tailwind design system primitives
│       ├── pages/              # Routed page components (Home, Cycle, Calendar, etc.)
│       ├── contexts/           # Theme and layout contexts
│       ├── lib/                # tRPC client, date utilities
│       └── App.tsx             # Application router and access gate
├── server/                     # Backend server source
│   ├── _core/                  # Server entry, context, cookies, trpc setup
│   ├── routers/                # Domain tRPC routers (auth, calendar, cycle, etc.)
│   ├── services/               # Independent services (auth, ai, email)
│   ├── db.ts                   # Drizzle ORM database helpers
│   ├── storage.ts              # S3-compatible and local file storage
│   └── *.test.ts               # Server and security test suites
├── drizzle/                    # Database migrations and schema definitions
│   ├── schema.ts               # Database table schemas
│   ├── meta/                   # Drizzle Kit migration journal and snapshots
│   └── *.sql                   # Deterministic SQL migrations (0000 - 0003)
├── shared/                     # Shared types and constants between client and server
├── .env.example                # Environment variable configuration template
├── package.json                # Project dependencies and npm scripts
└── vitest.config.ts            # Test runner configuration
```

---

## Local Setup

### Prerequisites

- **Node.js**: v20.x or higher
- **pnpm**: v10.x
- **Database**: MySQL 8.0+ or compatible instance

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd evara-project-extracted
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your database credentials and session secret:
   ```env
   DATABASE_URL=mysql://root:password@127.0.0.1:3306/evara
   SESSION_SECRET=a-secure-random-32-char-string
   ```

4. **Run database migrations**:
   ```bash
   pnpm db:push
   ```

5. **Start development server**:
   ```bash
   pnpm dev
   ```
   The application will be accessible at `http://localhost:3000`.

---

## Development Commands

| Command | Description |
|---|---|
| `pnpm dev` | Starts development server with Vite HMR and nodemon watching |
| `pnpm check` | Runs TypeScript compiler typecheck (`tsc --noEmit`) |
| `pnpm test` | Runs all Vitest test suites (unit, security, ownership, accessibility) |
| `pnpm build` | Builds frontend client with Vite and bundles server with esbuild |
| `pnpm start` | Runs the production build (`cross-env NODE_ENV=production node dist/index.js`) |
| `pnpm db:push` | Generates and executes database migrations via Drizzle Kit |

---

## Docker Deployment

To run Evara in a local Docker container with MySQL:

```bash
docker compose up -d --build
```

The stack includes:
- `evara_app`: Production Node.js container running on port 3000.
- `evara_mysql`: Persistent MySQL 8.0 container on port 3306.
- `evara_minio`: Optional local S3-compatible storage on port 9000/9001.

---

## Security & Privacy

1. **Health Data Isolation**: Every database read, mutation, and deletion is strictly scoped to `ctx.user.id`. Requests referencing records owned by another user return a non-disclosing 404.
2. **Session Persistence (Fail-Closed)**: Session authentication fails closed. If session creation cannot be written to the database, no authentication cookie is set and the request fails.
3. **Session Token Hashing**: Raw session tokens reside only in user HttpOnly cookies. The database stores only SHA-256 hashes of tokens, preventing token extraction from database dumps.
4. **Legacy Account Protection**: Legacy account claiming requires verification credentials matching the original account record (`verificationToken`). Email-only claiming is strictly blocked.
5. **Storage Authorization**: File proxy routes (`/api/storage/*`) require authentication and verify user ownership on user-scoped paths before returning assets or redirecting to presigned URLs.
6. **CSRF & Origin Protection**: Mutation requests (`POST`, `PUT`, `DELETE`, `PATCH`) to `/api/*` are validated against the request `Host` header to prevent cross-site form posting. Cookies use `SameSite=Lax` and `HttpOnly`.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
