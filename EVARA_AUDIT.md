# Evara Technical & Product Audit

**Scope:** Current published Evara application and its React/TypeScript, Express/tRPC, Drizzle, and MySQL/TiDB codebase.  
**Audit objective:** Confirm which product claims are implemented end-to-end, identify prototype or misleading behaviour, and prioritize privacy-first improvements without replacing functional work.

## Executive assessment

Evara is **not a static UI prototype**. It has a protected tRPC backend, Manus OAuth session handling, user-owned health-data tables, validated CRUD flows for periods, symptoms, wellness check-ins, and reminders, plus calculations derived from stored period history. The public landing page accurately describes the product as private and non-diagnostic.

The primary gap is now **product completeness rather than foundational architecture**. Health-data export and a doctor-ready summary are absent, reminder delivery is not connected to a scheduler, date validation is syntactic rather than calendar-aware, and a small set of mutation paths report success when an owned record was not found. The following work is designed to close those gaps incrementally.

| Area | Current state | Assessment |
|---|---|---|
| Application architecture | React 19, TypeScript, Tailwind, Express, tRPC, Drizzle, MySQL/TiDB | Functional, but it does not use the Angular architecture described in the original product brief. |
| Authentication | Manus OAuth with secure session cookie and `protectedProcedure` middleware | Implemented; custom password registration, reset, and session management do not apply to the selected OAuth provider. |
| Authorization | Every health-data helper scopes reads, updates, and deletes by `userId`; foreign keys cascade on account deletion | Strong server-side ownership boundary. |
| Period tracking | Database-backed CRUD, flow levels, edit/delete, average calculation from consecutive starts, transparent estimates | Implemented; date and duplicate-entry safeguards need strengthening. |
| Calendar | Month navigation, stored period/symptom/wellness records, estimated range, day detail | Implemented. |
| Symptoms and wellness | Database-backed CRUD with constrained severity and numeric validations | Implemented. |
| Insights | Frequency, cycle variability, recorded wellness trends, and timing context calculated from user records | Implemented; appropriately non-diagnostic. |
| Reminders | Private reminder preference CRUD and fixed discreet preview text | Stored preferences only; no scheduled delivery yet. |
| Privacy controls | Delete health data and delete account | Implemented; export and health-summary controls are missing. |
| Testing | Domain calculations, authentication logout, and source-level accessibility checks | Useful baseline; ownership, invalid-date, duplicate, and report tests are missing. |

## Confirmed end-to-end functionality

The period, symptom, wellness, calendar, insights, reminder-preference, onboarding, and deletion interfaces are connected to protected tRPC procedures. The backend receives the authenticated user from the server context and passes only `ctx.user.id` to every health-record query helper. Updates and deletes additionally include the record owner in their database filters. Consequently, a request that provides an identifier owned by a different user does not expose or mutate that other user’s record.

Cycle calculations are data-driven. The implementation orders recorded period starts chronologically, derives consecutive cycle lengths, excludes implausible values outside the configured boundary, calculates an average where history exists, and labels resulting dates as estimates. It does not hard-code a universal 28-day cycle.

## Findings and remediation priority

| Severity | Finding | Evidence | Resolution |
|---|---|---|---|
| High | Health report and user-owned export are absent. | Settings contains deletion controls but no export; no report router or page exists. | Add a protected report/export procedure and a printable three-month summary based solely on authenticated records. |
| High | Reminder delivery is not implemented although reminder preferences can be saved. | `reminders` router has CRUD only; no scheduler registration or notification dispatch exists. | Clearly describe the screen as saved reminder preferences until a user-notification delivery channel is connected. |
| High | Date validation accepts a correctly shaped but impossible calendar date. | `dateSchema` validates only `YYYY-MM-DD` format. | Add UTC calendar validation and test malformed month/day values. |
| Medium | Update/delete helpers return success even if the record is not owned or absent. | Ownership filter is present, but affected row counts are not inspected. | Return `NOT_FOUND` for a missing owned record without revealing cross-user existence. |
| Medium | Duplicate period start dates can be entered. | No same-user/start-date constraint or server preflight exists. | Reject duplicate starts per user and expose a calm correction message. |
| Medium | Reminder scheduler metadata exists in the schema but is unused. | `scheduleCronTaskUid` is never written by the reminder router. | Retain only when scheduling is introduced; avoid displaying delivery as active in the meantime. |
| Medium | Security regression coverage is incomplete. | Existing tests cover calculations and logout only. | Add tests for protected ownership filters, invalid dates, duplicate period starts, and exported report scope. |
| Low | Internal `ComponentShowcase` has demo interaction and logging. | It is un-routed but contains demo response content and direct logging. | Remove the un-routed showcase so the codebase has no prototype residue. |
| Low | The implementation does not match the requested Angular stack. | The deployed project uses React 19 and tRPC due to the existing project scaffold. | Preserve the working stack; document the actual architecture accurately in any portfolio description. |

## Security review

No application secret is embedded in the audited client code. OAuth sessions are handled by the platform scaffold and private server procedures use `protectedProcedure`. The database uses foreign keys with cascading deletion and per-user indexes on sensitive health data. Notes and other inputs are length-limited and validated before reaching database helpers.

The audit found no publicly reachable health-data route. The primary hardening work is behavioral: stronger calendar-date validation, unambiguous mutation outcomes, and regression tests that prove one user cannot affect another user’s records. Rate limiting is not presently added at application-procedure level and should be considered before a broader public launch.

## Product integrity review

The app does not use fake health statistics for the authenticated dashboard. Empty states are shown until the user records data. The public landing calendar is a deliberately decorative product preview rather than a user data claim; it does not present those dates as real personal records.

The one misleading risk is the reminder screen. Saving a reminder currently stores a private preference and its privacy-safe preview text; it does not schedule or send a user notification. This will be disclosed in the interface while report/export and data-integrity improvements are implemented.

## Implementation sequence

The upgrade will first harden dates, record mutation outcomes, duplicate prevention, and ownership tests. It will then add export and a printable health summary with no external AI or medical diagnosis claim. Finally, it will remove prototype residue, clarify reminder status, expand automated tests, and complete responsive/a11y validation.

## Release verification note

The previously published site was checked before this upgrade was checkpointed. Its new `/reports` route returned a 404 because the route belongs to the in-progress update rather than the prior deployment. The final validation phase must verify the route again after the upgraded checkpoint is published.

## Remediations completed in this upgrade

The audit findings have been addressed without replacing Evara’s working architecture. Calendar dates are now validated as real UTC dates; duplicate period starts are blocked per user at both application and database-constraint levels; and update/delete procedures now return a non-disclosing `NOT_FOUND` response rather than falsely reporting success when an owned record is absent.

Evara now provides an authenticated three-month health summary, browser-print support for saving it as a PDF, and a JSON download containing only the current user’s records without internal owner identifiers or scheduler metadata. The reminder interface now accurately describes the feature as persisted preferences rather than active notification delivery. The unused demo component showcase was removed. The completed test suite covers cycle calculations, valid/invalid dates, protected mutation outcomes, report ownership scope, export payload minimization, logout, and key accessibility semantics.
