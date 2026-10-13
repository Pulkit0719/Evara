# Evara Security Policy & Controls

This document details the security model, sensitive health data safeguards, and threat mitigations implemented in Evara.

## 1. Sensitive Health Data Protection

Menstrual cycles, symptoms, pain rankings, and wellness check-ins are sensitive personal health information:
- **Zero Cross-User Exposure**: All health data tables (`periodLogs`, `symptomLogs`, `wellnessLogs`, `userProfiles`, `reminders`) enforce foreign keys linked to `users.id`.
- **Query-Level Scoping**: Every query in `server/db.ts` filters strictly by the authenticated user ID (`where(eq(table.userId, ctx.user.id))`).
- **Non-Disclosing Mutation Outcomes**: Mutation or deletion requests targeting an unowned or missing record return a uniform `404 Not Found` rather than leaking record existence across accounts.
- **Export Sanitization**: Health summary and JSON export procedures strip internal database identifiers (`userId`, internal task IDs) before transmission.

---

## 2. Network & Transport Security

- **Strict-Transport-Security (HSTS)**: Enabled in production (`max-age=31536000; includeSubDomains`).
- **X-Content-Type-Options**: Set to `nosniff` on all responses.
- **X-Frame-Options**: Set to `SAMEORIGIN` to prevent clickjacking attacks.
- **Referrer-Policy**: Set to `strict-origin-when-cross-origin`.
- **Permissions-Policy**: Restricts access to sensitive browser capabilities (`camera=(), microphone=(), geolocation=()`).
- **Origin CSRF Defense**: Express verifies that state-changing requests (`POST`, `PUT`, `DELETE`, `PATCH`) originating from a browser match the expected `Host` header.

---

## 3. Storage Security

- **Authenticated Access**: The file proxy route `/api/storage/*` strictly requires an authenticated session.
- **Ownership Verification**: For user-scoped assets (`users/:userId/...` or `:userId/...`), the proxy verifies that the authenticated user matches the owner ID in the key (or holds the `admin` role). Unauthorized access is rejected with `403 Forbidden`.
- **Path Traversal Prevention**: Storage keys are normalized to prevent directory traversal (`..` sequences stripped).

---

## 4. Reporting Security Issues

If you identify a security vulnerability in Evara, please contact the repository owner directly rather than opening a public issue.
