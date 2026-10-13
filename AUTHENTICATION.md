# Evara Authentication System

This document outlines the authentication architecture, security safeguards, password handling, and session management in Evara.

## 1. Local Authentication Model

Evara uses independent local email and password authentication:
- **No Third-Party OAuth Required**: User identities, passwords, and sessions are 100% owned and controlled by your own database.
- **Node Built-in Cryptography**: Uses `crypto.scrypt` with 16-byte cryptographically secure random salts and 64-byte derived keys.
- **Timing-Safe Comparison**: `crypto.timingSafeEqual` prevents timing attacks during password verification.

---

## 2. Session Management & Token Hashing

Evara implements server-revocable database sessions with token hashing:

1. **Session Creation**:
   - Generates 32 bytes of cryptographic entropy (`rawToken`).
   - Computes SHA-256 hash: `tokenHash = sha256(rawToken)`.
   - Persists `tokenHash` in the `sessions` table (`id` column).
   - Issues `rawToken` to the browser via an HttpOnly cookie.

2. **Session Verification**:
   - Reads `app_session_id` cookie.
   - Computes SHA-256 hash of the received token.
   - Looks up `sessions.id = tokenHash` in the database.
   - Validates that `session.expiresAt > Date.now()`.

3. **Session Revocation**:
   - Upon logout, hashes the token, deletes the record from `sessions`, and clears the cookie with `maxAge: -1`.

4. **Fail-Closed Guarantee**:
   - If writing the session to the database fails, session creation throws an error and **no cookie is set**.

---

## 3. Cookie Security

Session cookies are configured with:
- `HttpOnly: true`: Inaccessible to client-side JavaScript, preventing XSS-based session theft.
- `SameSite: "lax"`: Protects against cross-site request forgery (CSRF) on mutation requests.
- `Secure: true`: Automatically enforced in production or whenever HTTPS is detected.
- `Path: "/"`: Bound strictly to the application root.

---

## 4. Legacy Account Migration Security

Existing accounts created under legacy OAuth retain their records:
- Legacy claiming requires **both** the registered email AND the account's unique verification token (`verificationToken`).
- Email-only claiming is strictly blocked and rejected with `403 Forbidden`.
- Accounts that already have a configured password cannot be re-claimed.
- All historical cycles, symptoms, and profile data remain attached to the user ID.

---

## 5. Rate Limiting

Sensitive authentication endpoints (`login`, `register`, `claimLegacyAccount`) are rate-limited:
- Process-local throttling limits attempts to 10 per 15-minute window per IP.
- Failed attempts increment the counter; successful logins reset the counter.
