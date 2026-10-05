# Infrastructure Cost & Free-Tier Report — Uptrail

**Primary Financial Constraint**: **HARD REQUIREMENT: ₹0 / $0 COST**  
**Audience**: Student / Independent Developer  
**Status**: **100% Zero-Cost Validated**

---

## 1. Monthly Cost Breakdown

| Component | Recommended Provider | Plan / Tier | Payment Method Required? | Auto-Billing Risk | Monthly Cost |
|---|---|---|---|---|---:|
| **Frontend** | Cloudflare Pages | Free Tier | No | None (Hard capped) | **₹0** |
| **Backend & API** | Render / Koyeb / Docker | Free Web Service | No | None (Sleeps after inactivity) | **₹0** |
| **Database** | TiDB Serverless | Free Forever | No | None (Throttles if exceeded) | **₹0** |
| **Object Storage** | Cloudflare R2 / Local Disk | Free Tier / Self-hosted | No (Local) / No for Free R2 | None (Zero egress fees) | **₹0** |
| **AI Inference** | Google Gemini / Groq / Ollama | Free Developer API / Local | No | None (Returns 429 when quota reached) | **₹0** |
| **Authentication** | Uptrail Self-Hosted | Node.js `scrypt` + DB Sessions | No | None | **₹0** |
| **Git Repository** | GitHub | Free Public/Private Repo | No | None | **₹0** |
| **Domain** | Provider Subdomain (`*.pages.dev`, `*.onrender.com`) | Free Provider Subdomain | No | None | **₹0** |
| **SSL / TLS Certificate** | Cloudflare / Let's Encrypt | Automatic Universal SSL | No | None | **₹0** |
| **TOTAL** | | | | | **₹0.00 / month** |

---

## 2. Free-Tier Limitations & Quota Inventory

| Service | Free Quota Limit | What Happens When Limit Is Reached? | Application Fail-Safe Behavior |
|---|---|---|---|
| **TiDB Serverless** | 25 GB data storage, 50M Request Units / month | Database throttles excess requests; **never automatically charges**. | App logs database degradation via `/readyz`. Data is preserved. |
| **Google Gemini Free API** | 15 Requests Per Minute (RPM), 1,500 Requests Per Day (RPD) | API returns HTTP 429; **never bills**. | Uptrail catches 429 and displays: *"AI service is temporarily unavailable because the free quota has been reached."* Remainder of app works normally. |
| **Groq Free API** | 30 RPM, 14,400 RPD | API returns HTTP 429; **never bills**. | Caught gracefully by `server/services/ai.ts`. |
| **Local Ollama** | Unlimited (runs on your hardware) | System CPU/RAM limit | 100% offline, zero cloud limits. |
| **Cloudflare R2** | 10 GB storage / month, 10M reads / month, zero egress fees | Operations blocked until next billing cycle. | Falls back to local disk storage (`.storage/uploads/`). |
| **Render Web Service** | 750 free instance hours / month | Service spins down after 15 min inactivity; wakes on next request (30s delay). | Normal for free hobby/student usage. |

---

## 3. Strict Non-Auto-Billing Guarantees

1. **No Credit Card Entered**: All recommended options (TiDB Serverless, Google AI Studio, Render Free, Cloudflare Pages, Local Ollama) can be set up without providing a credit card.
2. **Hard Spend Caps**: None of the selected providers have pay-as-you-go enabled by default on free tiers.
3. **Application Defense**: In `server/services/ai.ts`, in-memory daily counters prevent runaway looping requests from depleting free API quotas.
