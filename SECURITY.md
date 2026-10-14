# Evara Security Policy & Privacy Controls

This document details the security model, sensitive health data safeguards, threat mitigations, and custom domain readiness implemented in Evara.

---

## 1. Sensitive Health Data Protection & Privacy Controls

Menstrual cycles, symptoms, pain rankings, and wellness check-ins are sensitive personal health information:
- **Zero Cross-User Exposure**: All health data tables (`periodLogs`, `symptomLogs`, `wellnessLogs`, `userProfiles`, `reminders`) enforce foreign keys linked to `users.id`.
- **Query-Level Scoping**: Every query in `server/db.ts` filters strictly by the authenticated user ID (`where(eq(table.userId, ctx.user.id))`).
- **Non-Disclosing Mutation Outcomes**: Mutation or deletion requests targeting an unowned or missing record return a uniform `404 Not Found` rather than leaking record existence across accounts.
- **Export Sanitization**: Health summary and JSON export procedures strip internal database identifiers (`userId`, internal task IDs) before transmission.
- **Data Minimization**: The application stores only what the user explicitly inputs (flow intensity, symptoms, sleep hours, water intake, activity). It does NOT collect device fingerprints, location coordinates, contacts, or financial information.
- **Cascade Deletion on Request**: Deleting a user account executes an atomic cascade deletion that purges all logs, profiles, reminders, and sessions from the database.

---

## 2. Network & Transport Security

- **Strict-Transport-Security (HSTS)**: Enabled in production (`max-age=63072000; includeSubDomains; preload`).
- **X-Content-Type-Options**: Set to `nosniff` on all edge and server responses.
- **X-Frame-Options**: Set to `SAMEORIGIN` to prevent clickjacking attacks.
- **Referrer-Policy**: Set to `strict-origin-when-cross-origin`.
- **Permissions-Policy**: Restricts access to sensitive browser capabilities (`camera=(), microphone=(), geolocation=()`).
- **Origin CSRF Defense**: Express verifies that state-changing requests (`POST`, `PUT`, `DELETE`, `PATCH`) originating from a browser match the expected `Host` or `x-forwarded-host` header.

---

## 3. Storage Security

- **Authenticated Access**: The file proxy route `/api/storage/*` strictly requires an authenticated session.
- **Ownership Verification**: For user-scoped assets (`users/:userId/...` or `:userId/...`), the proxy verifies that the authenticated user matches the owner ID in the key (or holds the `admin` role). Unauthorized access is rejected with `403 Forbidden`.
- **Path Traversal Prevention**: Storage keys are normalized to prevent directory traversal (`..` sequences stripped).

---

## 4. Custom Domain Readiness

When adding a custom domain (e.g. `evara.app` or `mycycle.org`):

### 1. Vercel Configuration
1. Go to **Vercel Dashboard → Evara → Settings → Domains**.
2. Enter your custom domain (e.g. `evara.app`).
3. Vercel will provide the required DNS records:
   - Apex domain (`evara.app`): `A` record pointing to `76.76.21.21`.
   - Subdomain (`www.evara.app` or `app.evara.app`): `CNAME` record pointing to `cname.vercel-dns.com`.

### 2. HTTPS & TLS
- Vercel automatically issues and renews Let's Encrypt / ZeroSSL TLS certificates for the custom domain.

### 3. Application Compatibility & CSRF
- **Trust Proxy**: The Express app already sets `app.set("trust proxy", 1)`.
- **CSRF Origin**: The CSRF guard dynamically validates against `(req.headers["x-forwarded-host"] as string) || req.headers.host`, so switching domains requires **zero code changes**—the guard automatically adapts to the new domain.
- **Cookies**: Cookies use `path: "/"` without an explicit `domain` parameter, so they automatically bind to the active host.

---

## 5. Reporting Security Issues

If you identify a security vulnerability in Evara, please contact the repository owner directly at `admin@evara.app` or via GitHub private vulnerability reporting.
