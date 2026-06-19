---
title: Multi-source data for the weekly campaign report
date: 2026-06-16
status: blocked — awaiting GEA_crmAI producer work (CRM-first)
type: requirements
scope: Deep — feature
repos:
  consumer: GEA_ST_reports_weeklycampaign_vendor (this repo)
  producer: GEA_crmAI
---

# Multi-source data for the weekly campaign report

## Problem Frame

Today the weekly campaign report is assembled mostly by hand. An agent types
portal stats (REA/Domain views, enquiries, saves), inspection counts, and
commentary into the wizard each week, for each listing. Any single source
leaves fields **missing or out of date**, so reports go out with gaps, stale
numbers, or zeroes that read as "no activity" when the truth is "not entered".

The core pain is **incomplete / stale data**, not raw typing speed. The value of
"multiple sources" is therefore **coverage + freshness**: combine sources so
every section is populated with the most current data available, and make it
obvious when a field is genuinely missing.

## Key Decision — Data Architecture (resolved)

Data comes from **GEA_crmAI**, not from this app calling VaultRE/portals
directly. The weekly report becomes a **read-API consumer** of the CRM, mirroring
the existing pattern where the CMA report generator and review-requests flow
consume `GET /api/clients` with a per-consumer Bearer key
(see GEA_crmAI `docs/client-details-api.md`).

Rationale:
- The CRM is the right long-term aggregator: its Stage-2 spec positions it as the
  hub for listings, portal data (REA/Domain), comps, and market intelligence.
- A single integration point avoids duplicated, drifting VaultRE/portal
  integrations across apps.
- This app should not hold its own VaultRE credentials long-term.

Consequence: this app's existing direct VaultRE integration
(`src/lib/vaultre.ts`, `src/app/api/sync/vaultre/route.ts`) is **deprecated** in
favour of a CRM client. (Implementation sequencing — replace vs. wrap — is a
planning decision.)

## Verified Reality — the CRM is NOT ready yet (2026-06-16)

A code-level investigation of GEA_crmAI corrected an earlier assumption. As of
today the CRM does **not** yet provide this data:

- **No VaultRE integration in code** — only in `docs/plans/`. Property data
  currently comes from everypropertyAI, not VaultRE.
- **No portal stats** (views/enquiries/saves) — spec'd in
  `docs/STAGE-2-PROPERTY-DATA.md` §8 as Phase 2C, not built.
- **Inspections: PM module only** (`GET /api/pm/inspections`, tenancy) — no
  sales open-home / attendee data.
- **Read endpoints not consumer-auth'd** — `/api/properties`, `/api/listings`
  rely on Supabase RLS; the per-consumer Bearer-key pattern covers only a few
  endpoints today.
- **No external/VaultRE property ID** — matching would fall back to address text.

## CRM Readiness — audit 2026-06-18 (pipes built, no data)

A code-level audit of GEA_crmAI shows the **read-API contract is shipped**, but
the data behind it is not yet flowing:

- ✅ **Auth** — `weekly-report` consumer Bearer key (`WEEKLY_REPORT_API_TOKEN`),
  applied to `/api/report/*`. (Env-var based; confirm it's set in Railway prod.)
- ✅ **Property keying** — `Listing.vaultExternalId` (indexed) + resolver:
  `GET /api/report/resolve?vaultId=…|address=…` → `{ listingId, vaultExternalId }`.
- ✅ **Gap-aware stats contract** — `GET /api/report/listings/{id}` returns each
  metric as `{ value, source, capturedAt, gap }` — matches our gap-vs-zero need.
- 🟡 **Property payload thin** — missing price guide, listed date, days on market,
  agent, vendor name (only an unresolved `ownerContactId`). Field-mapping fix.
- 🟡 **Portal stats: schema only** — `CampaignStat` model exists but
  `recordStatCapture` is test-only; **no production writer** → all metrics return
  `gap:true` in prod. No REA/Domain split (single generic `source` string).
- ❌ **Sales inspections / open-homes** — not modelled (PM tenancy endpoint only).
- ❌ **VaultRE sync + token** — no client, no job, token not configured;
  `vaultExternalId` only set via manual/CSV import, so the resolver mostly 404s.

Consumer requests confirmed working today:
`GET /api/report/resolve?vaultId=…` and `GET /api/report/listings/{id}`, both with
`Authorization: Bearer <WEEKLY_REPORT_API_TOKEN>`.

## Stat-ingestion Decision — CRM owns it (resolved 2026-06-18)

Portal stats (and VaultRE/inspection data) are ingested **entirely by the CRM**
(scraping / VaultRE sync). This report app stays a **pure consumer** — it does not
write stats into the CRM. Trade-off accepted: the report is blocked on this data
until the CRM builds the ingestion, rather than shipping an interim report-side
writer.

## Sequencing Decision — CRM-first (resolved)

Chosen: **build the producer side in GEA_crmAI first**, then have the weekly
report consume it. The report waits on the CRM rather than shipping an interim
direct integration. This means the immediate next effort is a **separate
brainstorm/plan in the GEA_crmAI repo** covering:

1. VaultRE integration (sync into the CRM; the pending VaultRE token lives here).
2. Portal-stats capture + storage (views/enquiries/saves, time-series).
3. Sales-listing inspection / open-home data (distinct from the PM module).
4. Consumer-key auth on the property/campaign read endpoints.
5. A stable property-keying scheme for external consumers.

This requirements doc (the **consumer** side) is **blocked** until that producer
work exposes the needed read endpoints.

## Actors

- **A1 — Agent** (Grants Estate Agents sales agent): generates, reviews, edits,
  and approves the weekly report. The only human in the loop.
- **A2 — Vendor / landlord**: views the approved report via the token-gated
  portal. Read-only; never sees drafts.
- **A3 — GEA_crmAI** (system): upstream source of truth. Aggregates VaultRE +
  portal + comps + market data and exposes it via a read API.

## Goals & Success Criteria

- **G1** Every report section auto-populates from the CRM before the agent
  touches it. Success: an agent opening a fresh weekly draft sees stats,
  inspections, and market context already filled wherever the CRM has data.
- **G2** Missing data is visibly flagged as a **gap**, never shown as a blank or
  a misleading zero. Success: a field the CRM can't supply is clearly marked
  "no data" / "needs entry", distinct from a real zero.
- **G3** Each value carries **provenance + freshness** — where it came from and
  how current it is. Success: the agent can see, per field, the source and its
  recency.
- **G4** When two sources disagree on the same field, the draft **shows both and
  the agent picks** — no silent winner.
- **G5** Agent review remains the approval gate. Success: nothing reaches the
  vendor portal without explicit agent approval.

## Requirements

- **R1** The weekly report consumes property/campaign data from GEA_crmAI via an
  authenticated read API (per-consumer Bearer key issued by the CRM).
- **R2** Coverage spans **all report sections**: portal stats (REA + Domain
  views/enquiries/saves/search appearances), inspections (open-home attendees,
  private inspections), property metadata, and market context.
- **R3** Where the CRM supplies a field, it pre-fills the draft. Where it does
  not, the field is flagged as a gap for manual entry (R-G2).
- **R4** Each pre-filled field records source attribution and a freshness
  indicator (R-G3).
- **R5** Conflicting values from multiple sources are surfaced side-by-side for
  agent selection (R-G4).
- **R6** The agent can override any pre-filled value before approval.
- **R7** Market news / commentary continues to combine AI drafting with a
  web/RSS source; this is independent of the CRM data path.
- **R8** This app's direct VaultRE integration is retired once the CRM path
  covers its fields.

## Key Flows

- **F1 — Generate weekly drafts**: agent triggers "generate this week's drafts";
  for each property the app calls the CRM read API, pre-fills available fields
  with provenance, flags gaps. (Covers G1, G2, G3.)
- **F2 — Review & reconcile**: agent opens a draft, sees pre-filled values + any
  side-by-side conflicts, fills flagged gaps, overrides as needed. (Covers G4,
  R6.)
- **F3 — Approve & publish**: agent approves; the report becomes visible in the
  vendor/landlord portal. (Covers G5.)

## Acceptance Examples

- **AE1** A listing with CRM-held portal stats: opening the draft shows views /
  enquiries / saves pre-filled, each tagged with source and recency. (R3, R4)
- **AE2** A listing where the CRM has no inspection data this week: the
  inspections fields are flagged "needs entry", not shown as 0. (R3, G2)
- **AE3** Portal stats present in both a CRM-held VaultRE value and a portal
  figure that disagree: both are shown with their source; the agent's pick is
  what saves to the draft. (R5, G4)
- **AE4** Agent edits a CRM-supplied figure before approving: the override is
  what the vendor sees. (R6)

## Scope Boundaries

### In scope
- Consuming CRM read endpoints for all report sections.
- Per-field provenance, freshness, gap-flagging, and conflict surfacing in the
  weekly draft + wizard UI.
- Retiring this app's direct VaultRE integration.

### Deferred for later
- The CRM-side work to **expose** portal-stats and inspection/open-home read
  endpoints if they are not yet served (see Dependencies). This is producer-side
  and may be scoped as its own piece of work in the GEA_crmAI repo.
- Automatic conflict resolution / source-priority rules (explicitly rejected for
  now in favour of "show both, agent picks").

### Outside this product's identity
- Building new direct REA/Domain or VaultRE integrations *in this app* — that
  responsibility now belongs to GEA_crmAI.
- Auto-approving or auto-sending reports without agent review.

## Dependencies & Assumptions

- **D1 (blocking, producer-side)** GEA_crmAI must expose authenticated read
  endpoints for the fields this report needs. **Confirmed today:** the CRM
  already serves clients/contacts and listing/property data. **Unconfirmed:**
  whether it yet serves **portal stats (views/enquiries/saves)** and
  **inspection/open-home** data as read endpoints — its Stage-2 property-data
  spec is still a draft. If not, that endpoint work is a prerequisite.
- **D2** GEA_crmAI's underlying VaultRE access is itself pending an API **token**
  (key issued, token to be generated by the office admin). This is now a CRM
  concern, not this app's.
- **A-assume1** VaultRE read endpoints for portal stats, open homes, and
  inspections exist at the API level (confirmed via VaultRE API changelog:
  portal-stats retrieval added 2022-03-13; `GET /openHomes`; inspections
  endpoints). Whether the agency's account has *populated* portal-stats data
  depends on its portal feed — to be verified once the CRM's VaultRE token is
  live.
- **A-assume2** The CRM will issue this app a dedicated consumer API key,
  individually revocable, following its existing per-consumer key pattern.
- **A-assume3** "Freshness" requires each CRM-supplied value to carry a
  timestamp; sources without a natural timestamp (e.g. AI-drafted news) are
  handled outside the CRM data path (R7).

## Open Questions

- **Q1** Does the CRM already serve portal-stats and inspection data, or is that
  endpoint work still to be done? (Resolves D1; check GEA_crmAI `/api/properties`
  / `/api/campaigns` / Stage-2 implementation.)
- **Q2** What is the exact response shape the CRM returns per property
  (field names, nesting, timestamp fields)? Determines the consumer mapping.
- **Q3** How does the weekly report key a property to the CRM — by VaultRE
  listing id, address, or a CRM property id? (Affects the request contract.)

## Approaches Considered

- **Consume via GEA_crmAI read API (chosen).** Single source of truth; no
  duplicated integrations; removes this app's VaultRE token dependency. Cost: a
  cross-repo contract and likely producer-side endpoint work.
- **Hybrid (CRM where available, direct VaultRE/exports for gaps).** Faster to
  partial coverage but reintroduces a second VaultRE integration in this app and
  the drift it causes. Rejected as the steady state; may appear transiently
  during migration.
- **Direct integration in this app (status quo+).** Lowest cross-repo
  coordination but duplicates credentials and integration logic across apps and
  keeps the token blocker. Rejected.

## Sources & Research

- VaultRE API — [changelog](https://docs.api.vaultre.com.au/changelog.html),
  [integrator endpoints](https://docs.api.vaultre.com.au/integrator.html),
  [getting started](https://docs.api.vaultre.com.au/basics.html).
  Confirmed read endpoints: portal stats retrieval, `GET /openHomes`,
  inspections, `GET /campaigns/{id}/tracking`.
- GEA_crmAI repo — `docs/client-details-api.md` (per-consumer read-API pattern),
  `docs/STAGE-2-PROPERTY-DATA.md` (aggregator architecture & external sources),
  VaultRE plans under `docs/plans/`.
- This repo — `src/lib/vaultre.ts`, `src/app/api/sync/vaultre/route.ts`
  (direct integration to be retired), `src/lib/weekly-drafts.ts`,
  `src/lib/types.ts` (report section shape).
