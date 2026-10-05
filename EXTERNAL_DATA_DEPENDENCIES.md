# External Data & API Dependencies Audit — Uptrail

This document verifies all external data sources, third-party APIs, and dependencies used by Uptrail to ensure zero legal liability, zero paid API lock-in, and zero risk of unexpected service shutdown.

---

## 1. Inventory of External APIs & Datasets

| Dependency | Purpose | Location | License / Terms | Free Tier / Quota | Cost | Action / Status |
|---|---|---|---|---|---|---|
| **Google Fonts** (`DM Sans`, `DM Mono`, `Fraunces`) | Web typography | `client/index.html` | SIL Open Font License (Free for personal and commercial use) | Unlimited public CDN | ₹0 | **KEEP** — Standard web fonts, no tracking credentials required. |
| **Google Maps API** | Formerly present in template scaffold | `client/src/components/Map.tsx`, `server/_core/map.ts` | Commercial API (requires credit card & billing account) | Pay-as-you-go risk | Risk of charges | **REMOVED** — Deleted entirely. Uptrail is a private wellness tracker that does not require geolocation. |
| **Cycle & Period Calculations** | Predicting future periods, cycle variability, and statistics | `server/lib/evara.ts` | 100% In-House Mathematical Algorithms | Unlimited local execution | ₹0 | **KEEP** — Pure algorithmic math based strictly on the user's own logged historical dates. No external prediction API. |
| **AI Insights / Chat Completions** | Optional summarization / wellness assistant | `server/services/ai.ts` | Choice of Google Gemini Free Tier, Groq Developer Free Tier, or Local Ollama | • Gemini: 15 RPM free<br>• Groq: Generous free quota<br>• Ollama: 100% unlimited offline | ₹0 | **PROVIDER AGNOSTIC** — Configured via standard environment variables. Application implements automatic fallback when quota is reached. |
| **Object & File Storage** | User file uploads (optional) | `server/storage.ts` | AWS S3, Cloudflare R2, MinIO, or Local Disk | • Cloudflare R2: 10 GB/month free<br>• Local Disk: 100% unlimited free | ₹0 | **PORTABLE** — Operates using standard S3 API with automatic local disk fallback. |
| **Umami Analytics** | User tracking | Injected in template | Proprietary tracking endpoint | N/A | ₹0 | **REMOVED** — Removed to protect user privacy and remove external network requests. |

---

## 2. Licensing & Compliance Confirmation

1. **No Proprietary Datasets**: Uptrail does not bundle, scrape, or distribute any proprietary third-party datasets.
2. **Medical Disclaimer Integrity**: All health statistics and cycle estimates are non-diagnostic, privacy-first calculations derived solely from authenticated user input. No diagnostic medical database or clinical SaaS is used.
3. **Offline Operability**: Uptrail can run completely disconnected from the public internet if configured with a local database (`mysql://localhost`), local file storage (`.storage/uploads`), and local Ollama (`http://localhost:11434/v1`).
