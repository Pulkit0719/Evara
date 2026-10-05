# Uptrail

An independent, private, full-stack application designed for menstrual cycle tracking, symptom logging, and everyday wellness insights.

Uptrail is completely self-hosted and infrastructure-independent: it operates with standard local authentication, server-revocable sessions, an additive database schema, S3-compatible object storage, and a provider-agnostic AI service adapter.

---

## Features

- **Cycle Tracking**: Log periods, track flow intensity, record cycle history, and calculate average cycle lengths with data-driven estimates.
- **Interactive Calendar**: Monthly cycle overview with recorded periods, estimated windows, daily symptoms, and wellness check-in markers.
- **Symptom & Wellness Logs**: Record symptoms with severity rankings, daily mood, energy, sleep hours, water intake, activity, and stress.
- **Private Insights**: Identify personal trends in symptoms, mood, and sleep across cycle phases without predictive or diagnostic medical claims.
- **Doctor-Ready Summaries & Data Export**: Generate printable summaries and export health records on demand.
- **Local & Independent Authentication**: Email and password authentication with `scrypt` hashing, server-side session revocation, rate-limiting, and legacy account migration.
- **S3-Compatible Storage**: Uploads supported via AWS S3, Cloudflare R2, MinIO, or local filesystem fallback.
- **Universal AI Service Adapter**: Provider-agnostic chat completions compatible with OpenAI, Groq, Ollama, DeepSeek, Together AI, or local vLLM instances.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Lucide Icons, Wouter |
| **Backend** | Node.js, Express, tRPC (v11), Zod |
| **Database & ORM** | MySQL / TiDB compatible, Drizzle ORM, Drizzle Kit |
| **Authentication** | Node `crypto.scrypt`, revocable database sessions, HttpOnly cookies |
| **Object Storage** | AWS SDK v3 (`@aws-sdk/client-s3`), local disk fallback |
| **AI Integration** | Provider-independent OpenAI-compatible adapter |
| **Testing** | Vitest, TypeScript compiler (`tsc`) |

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
│   ├── _core/                  # Server entry, context, cookies, system router
│   ├── routers/                # Domain tRPC routers (auth, calendar, cycle, etc.)
│   ├── services/               # Independent services (auth, ai)
│   ├── db.ts                   # Drizzle ORM database helpers
│   ├── storage.ts              # S3-compatible and local file storage
│   └── *.test.ts               # Server and security test suites
├── drizzle/                    # Database migrations and schema definitions
│   ├── schema.ts               # Database table schemas
│   └── *.sql                   # Additive SQL migrations
├── shared/                     # Shared types and constants between client and server
├── .env.example                # Environment variable configuration template
├── package.json                # Project dependencies and npm scripts
└── vitest.config.ts            # Test runner configuration
```

---

## Prerequisites

- **Node.js**: v20.x or higher (LTS recommended)
- **pnpm**: v9.x or v10.x
- **Database**: MySQL 8.0+, TiDB, or a compatible MySQL database instance

---

## Installation & Setup

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
   DATABASE_URL=mysql://user:password@localhost:3306/uptrail
   SESSION_SECRET=a-secure-random-32-char-string
   ```

4. **Run database migrations**:
   ```bash
   pnpm db:push
   ```
   Or execute the SQL migration scripts in `drizzle/` directly against your database.

---

## Local Development

Start the development server with Vite hot module replacement (HMR) and backend tsx reload:

```bash
pnpm dev
```

The application will be accessible at:
```text
http://localhost:3000
```

---

## Running Tests & Type Checks

Run the automated test suite (unit tests, security tests, responsive/a11y regression checks):
```bash
pnpm test
```

Perform static type checking:
```bash
pnpm check
```

---

## Production Build & Deployment

1. **Build the production assets**:
   ```bash
   pnpm build
   ```
   This generates the compiled client assets in `dist/public` and bundles the Node server in `dist/index.js`.

2. **Start the production server**:
   ```bash
   pnpm start
   ```

3. **Production Considerations**:
   - Set `NODE_ENV=production`.
   - Ensure `SESSION_SECRET` is set to a cryptographically strong secret.
   - Serve the application behind a reverse proxy (such as Nginx, Caddy, or a Cloudflare load balancer) with TLS termination.
   - For file uploads, configure `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` (compatible with AWS S3, Cloudflare R2, MinIO, or Backblaze B2).
   - Health check endpoints:
     - `GET /healthz`: Basic liveness check (200 OK)
     - `GET /readyz`: Database connectivity check (200 OK or 503 Degraded)

---

## Security Architecture

- **Password Storage**: Passwords are hashed using `crypto.scrypt` with a cryptographically secure 16-byte random salt per user. Timing-safe comparison prevents timing attacks.
- **Sessions**: Session tokens are 256-bit random tokens stored in the `sessions` table and issued via HttpOnly, `SameSite=Lax` cookies. Sessions can be revoked instantly on the server.
- **Rate Limiting**: In-memory rate limiting throttles brute-force attempts on login, registration, and account claiming.
- **Data Scoping**: Every database query for health records is strictly filtered by the authenticated user's ID (`ctx.user.id`).
- **No Third-Party Tracking**: All external analytics trackers and vendor telemetry have been eliminated.
