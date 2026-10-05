# Manus Dependency Audit — Uptrail

This document provides a comprehensive dependency map and technical audit of all components identified during the codebase inspection, classifying every item by its purpose, dependency level, usage, risk profile, and required action.

---

## 1. Dependency Inventory Table

| Component | Current Purpose | Manus Dependency | Used? | Risk | Action | Replacement |
|---|---|---|---|---|---|---|
| **Manus OAuth Router** (`server/_core/oauth.ts`) | External OAuth login redirect and callback | Requires Manus OAuth portal (`api.manus.im`) | Yes (Original) | High (Blocks login if Manus disappears) | **REPLACE** | Application-owned local auth in [`server/services/auth.ts`](file:///C:/VScode/evara-project-extracted/server/services/auth.ts) and [`server/routers/auth.ts`](file:///C:/VScode/evara-project-extracted/server/routers/auth.ts) using `scrypt` hashing and session cookies. |
| **Manus Auth SDK** (`server/_core/sdk.ts`) | Request authentication and token exchange stub | Manus authentication server | Yes (Original) | High (Breaks all `protectedProcedure` calls) | **REPLACE** | Direct request authentication helper (`authenticateRequest`) validating database sessions. |
| **Legacy OpenId Column** (`drizzle/schema.ts`) | User identity primary key lookup | Tied to Manus OAuth OpenID format | Yes (Legacy records) | Medium (Schema incompatibility if removed) | **REFACTOR** | Kept `openId` for backward compatibility, added additive `passwordHash` column, and created a secure account migration claim flow. |
| **Session Cookie Policy** (`server/_core/cookies.ts`) | Set session cookie options | Hardcoded `sameSite: "none"` for `*.manus.space` iframe embeds | Yes | Low | **REFACTOR** | Modern first-party `SameSite: "lax"`, `HttpOnly: true`, and production `Secure` flags. |
| **Forge AI Completions** (`server/_core/llm.ts`) | Text generation / chat completions | `https://forge.manus.im/v1/chat/completions` via `BUILT_IN_FORGE_API_KEY` | Optional | Medium (Runtime failure when key revoked) | **REPLACE** | Provider-independent universal adapter in [`server/services/ai.ts`](file:///C:/VScode/evara-project-extracted/server/services/ai.ts) supporting Google Gemini Free Tier, Groq, Ollama, and OpenAI-compatible APIs with ₹0 quota fail-safes. |
| **Forge Storage Proxy** (`server/storage.ts`, `server/_core/storageProxy.ts`) | Uploads and downloads for media/files | Forge presigned URL endpoint (`v1/storage/presign/put`) and `/manus-storage/*` proxy | Optional | Medium (Uploads fail when Forge is offline) | **REPLACE** | Native S3 SDK (`@aws-sdk/client-s3`) supporting Cloudflare R2, MinIO, or AWS S3, with an automatic local disk fallback (`.storage/uploads/`). |
| **Manus Notification RPC** (`server/_core/notification.ts`) | Dispatch notifications to project owner | Manus WebDev RPC (`WebDevService/SendNotification`) | Unused by UI | Low | **REPLACE** | Standard HTTPS webhook (`NOTIFICATION_WEBHOOK_URL`) with graceful local console logging fallback. |
| **Manus Umami Analytics** (`client/index.html`) | Injected script tracking user views | `https://manus-analytics.com` | Unused by app | Low (Privacy leak to third party) | **REMOVE** | Completely stripped from `client/index.html`. |
| **Manus Dev Runtime Plugin** (`package.json`, `pnpm-lock.yaml`) | Vite dev server overlay and debugging | `vite-plugin-manus-runtime` npm package | Dev only | Low | **REMOVE** | Uninstalled from `package.json` and updated lockfile. |
| **Manus Data API** (`server/_core/dataApi.ts`) | Manus proprietary remote database proxy | `BUILT_IN_FORGE_API_URL` | No | None | **REMOVE** | Deleted unused file. |
| **Manus Heartbeat Cron** (`server/_core/heartbeat.ts`) | Scheduled background cron triggers | `callForge("DeleteHeartbeatJob")` | No | None | **REMOVE** | Deleted unused file. |
| **Forge Image Generation** (`server/_core/imageGeneration.ts`) | Generates images via Forge image API | Forge images endpoint | No | None | **REMOVE** | Deleted unused file. |
| **Forge Voice Transcription** (`server/_core/voiceTranscription.ts`) | Audio transcription | Forge audio endpoint | No | None | **REMOVE** | Deleted unused file. |
| **Forge Maps Proxy** (`server/_core/map.ts`, `client/src/components/Map.tsx`) | Google Maps proxy via Forge | `VITE_FRONTEND_FORGE_API_KEY` | No | None | **REMOVE** | Deleted unused server and client files. |
| **Manus Sandbox Checkpoints** (`.manus/`, `.project-config.json`) | Manus internal configuration & checkpoint zips | Sandbox build artifacts | No | Low (Contains expired remote tokens) | **REMOVE** | Deleted `.manus/` and `.project-config.json`. |
| **Core Domain Logic & Data Tables** (`drizzle/schema.ts`, `server/lib/evara.ts`) | Period calculation, wellness tracking, symptoms, reports | None | Yes | High (Core user data) | **KEEP** | 100% preserved and verified by automated regression test suite. |

---

## 2. Action Summary

- **REMOVE**: 10 components (unused Forge APIs, maps, audio, image generation, Umami analytics, sandbox artifacts, runtime plugin).
- **REPLACE**: 4 components (OAuth replaced by local auth, Forge AI replaced by universal AI adapter, Forge storage replaced by S3/local storage, Forge notification replaced by webhook).
- **REFACTOR**: 2 components (cookies hardened for first-party usage, user schema upgraded additively for local passwords).
- **KEEP**: All core product components (cycle calculations, calendar, symptoms, wellness logs, reminders, reports, UI).
