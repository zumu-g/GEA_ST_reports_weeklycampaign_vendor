---
title: "feat: Store sent weekly reports back in GEA_crmAI (sent-report log)"
date: 2026-06-24
status: active
type: feat
origin: docs/brainstorms/2026-06-23-weekly-report-sent-log-to-crm-requirements.md
repos:
  consumer: GEA_ST_reports_weeklycampaign_vendor (this repo)
  producer: GEA_crmAI
---

# feat: Store sent weekly reports back in GEA_crmAI (sent-report log)

> **Cross-repo plan.** Units are tagged **[CRM]** (producer, `GEA_crmAI`) or
> **[APP]** (consumer, this repo). All paths are repo-relative to the tagged repo.

## Summary

Record each weekly report in GEA_crmAI as a lightweight **sent-report log** keyed
to the listing. When an agent **approves** a report, the app writes an `approved`
record; when it is **sent** to the owner, the same record is stamped with sent-at
+ recipient (`sent`). An agent viewing the listing in the CRM sees its
weekly-report history inline. This is the report app's **first and only write** to
the CRM — a deliberate, narrow exception to the pure-consumer principle, scoped to
report-comms metadata; the CRM still solely owns stat ingestion
(see origin: `docs/brainstorms/2026-06-23-weekly-report-sent-log-to-crm-requirements.md`).

---

## Problem Frame

Nothing flows back from the report app to the CRM today. Once a report is approved
and sent, there is no record in the system of record that it happened — the
history lives only as draft JSON in the app's iCloud markdown store, invisible
from the CRM listing view where agents work. This plan adds that trail.

---

## Key Technical Decisions

- **KTD1 — Dedicated `SentReport` model (CRM).** A purpose-built table linked to
  `Listing`, unique on `(listingId, weekEnding)`, holding the lifecycle fields.
  Chosen over a generic activity-log row for a clear shape, a real uniqueness
  guarantee (R3/G4), and room to add a snapshot reference later. (origin Q2)
- **KTD2 — Reuse the `weekly-report` consumer key for the write.** The write
  endpoint accepts the existing Bearer key the app already holds — no new secret to
  issue/configure. Accepted trade-off: that key now grants read + write; a
  write-scoped key is a future hardening (noted in Risks). (origin Q1)
- **KTD3 — Upsert by `(listingId, weekEnding)`.** Both approve and send perform an
  idempotent upsert of the full current record state, so re-approve/re-send
  updates the one row (R3/G4) and a previously-failed write self-heals on the next
  successful call — this *is* the reconciliation mechanism (origin Q3 default).
- **KTD4 — Non-blocking, best-effort write from the app.** The CRM write is fired
  from the approve and send paths but never blocks them: a failure is logged and
  left for the next upsert to reconcile; approve/send still succeed (R5/G3).
- **KTD5 — Listing keyed by address resolve.** The app resolves the CRM
  `listingId` via the existing `resolveListing({ address })` path before writing;
  an unresolved address is logged for reconciliation, not silently dropped (R3/R5).
- **KTD6 — Server-side write only.** The write happens in the app's API routes;
  the consumer token never reaches the browser (R6), mirroring the read client.
- **KTD7 — Delivery channel as a nullable field.** Capture `channel` (e.g.
  `email`) when known (the notify path), null otherwise — cheap room for the
  origin Q4 audit detail without committing to full channel tracking.

---

## High-Level Technical Design

```mermaid
sequenceDiagram
  participant Ag as Agent
  participant App as Report app (API routes)
  participant CRM as GEA_crmAI

  Ag->>App: Approve draft
  App->>CRM: resolve listing by address
  App->>CRM: upsert SentReport (status=approved)  %% best-effort
  Note over App,CRM: failure logged, not blocking; next upsert reconciles
  Ag->>App: Send to owner (notify)
  App->>CRM: upsert SentReport (status=sent, sentAt, recipient, channel)
  Ag->>CRM: Open listing view
  CRM-->>Ag: weekly-report history (per (listing, week))
```

---

## Implementation Units

### U1. [CRM] `SentReport` model + migration

**Goal:** Persist a sent-report record keyed to a listing and week.
**Requirements:** R1, R2, R3; KTD1, KTD3. Advances G1, G4.
**Dependencies:** none.
**Files:** `prisma/schema.prisma` (new `SentReport` model + `Listing` relation),
`prisma/migrations/**` (generated migration).
**Approach:** Model fields: `id` (cuid), `listingId` (FK → `Listing`, cascade),
`weekEnding` (date), `status` (enum/string: `approved` | `sent`), `approvedBy`,
`approvedAt`, `sentAt` (nullable), `recipientName`/`recipientEmail` (nullable),
`portalUrl`, `channel` (nullable, KTD7), `createdAt`/`updatedAt`. **Unique
constraint `(listingId, weekEnding)`** (KTD3). Mirror the conventions of the
existing `CampaignStat` model.
**Patterns to follow:** `CampaignStat` model + its relation/index style in
`prisma/schema.prisma`.
**Test scenarios:** `Test expectation: none -- schema/migration; behaviour covered
by U2/U3 tests.`
**Verification:** migration applies cleanly; `(listingId, weekEnding)` uniqueness
enforced at the DB level.

### U2. [CRM] DAL: upsert + list sent reports

**Goal:** Data-access functions to upsert a sent-report and list a listing's
reports.
**Requirements:** R3, R4; KTD3.
**Dependencies:** U1.
**Files:** `src/lib/dal/sent-reports.ts` (new),
`src/lib/dal/__tests__/sent-reports.test.ts` (new).
**Approach:** `upsertSentReport(input)` — upsert on `(listingId, weekEnding)`,
merging the provided lifecycle fields without nulling fields it doesn't carry
(an approve call must not wipe a prior `sentAt`). `listSentReportsForListing(
listingId)` → newest-first. Map Prisma rows to a DTO like the other DALs.
**Patterns to follow:** `src/lib/dal/listings.ts` (`prismaListingToMock` mapping,
function shape), `src/lib/dal/campaign-stats.ts` (per-listing queries).
**Test scenarios:**
- upsert with a new `(listing, week)` creates one row (`approved`).
- second upsert same key with `status=sent` updates the row, preserves
  `approvedAt`/`approvedBy` (merge, not overwrite). Covers AE2.
- re-upsert same key does not create a duplicate. Covers AE3.
- `listSentReportsForListing` returns rows newest-first for the listing only.
**Verification:** DAL tests cover create, merge-update, idempotency, and listing
scoping against the test DB/mock.

### U3. [CRM] Authenticated upsert write endpoint

**Goal:** `POST /api/report/sent-reports` upserts a sent-report for an authorised
consumer.
**Requirements:** R1, R2, R6; KTD2, KTD3, KTD5.
**Dependencies:** U2.
**Files:** `src/app/api/report/sent-reports/route.ts` (new),
`src/app/api/report/sent-reports/__tests__/route.test.ts` (new).
**Approach:** `verifyApiKey(request).ok` (accepts the `weekly-report` key, KTD2) →
401 otherwise. Body: `{ listingId?, address?, weekEnding, status, approvedBy?,
approvedAt?, sentAt?, recipientName?, recipientEmail?, portalUrl?, channel? }`.
Resolve `listingId` from `address` when not supplied (reuse the resolver DAL);
404/unprocessable when neither resolves. Call `upsertSentReport`; return the
stored record. `withCors` + `OPTIONS` preflight; `try/catch` → 500. Mirror the
existing report routes exactly.
**Patterns to follow:** `src/app/api/report/listings/[id]/route.ts` (auth, CORS,
error shape), `src/app/api/report/resolve/route.ts` (address resolution).
**Test scenarios:**
- no/invalid bearer → 401.
- valid key + body with `listingId` + `status=approved` → 200, record stored.
  Covers AE1.
- body with `address` (no listingId), resolvable → record stored against resolved
  listing.
- `address` unresolvable and no `listingId` → 4xx (caller treats as reconcile).
  Covers AE5.
- second call same `(listing, week)` `status=sent` → updates, no duplicate.
  Covers AE2, AE3.
- CORS headers echoed for an allowlisted origin; absent otherwise.
**Verification:** endpoint tests cover auth, create, address-resolve, unresolved,
idempotent update, CORS — mirroring the `[id]` route test suite.

### U4. [CRM] Surface report history on the listing view

**Goal:** An agent viewing a listing in the CRM sees its weekly-report history
inline.
**Requirements:** R4; G1. Covers F3.
**Dependencies:** U2.
**Files:** the listing detail view component/page under `src/app/` (the existing
listing view — confirm exact path at execution), reading via
`listSentReportsForListing`.
**Approach:** Render a compact history list/section on the listing: per row,
week-ending, status, approved-by/at, sent-at, recipient. Read server-side via the
DAL (no new public GET endpoint needed — the CRM renders its own listing view).
Empty state when no reports yet.
**Patterns to follow:** existing listing-detail sections in the CRM app; existing
DAL-backed server-component data loads.
**Test scenarios:**
- listing with two reports → both render newest-first with lifecycle fields.
- listing with none → empty state, no error.
- a `sent` row shows sent-at + recipient; an `approved`-only row does not.
**Verification:** listing view renders the history for seeded records and an empty
state; numbers/dates match the stored rows.

### U5. [APP] CRM client: record sent report

**Goal:** A server-side client call to upsert a sent-report, non-throwing.
**Requirements:** R1, R6; KTD4, KTD6.
**Dependencies:** U3 (endpoint contract).
**Files:** `src/lib/crm-client.ts` (add `recordSentReport(input)`),
`src/lib/crm-client.test.ts` (extend).
**Approach:** `recordSentReport(input): Promise<CrmResult<...>>` POSTing to
`/api/report/sent-reports` with the existing Bearer auth via the shared
`crmFetch`. Returns a typed result; never throws (KTD4) so callers degrade. Sends
`address` (and `vaultExternalId` when available) so the CRM resolves the listing.
**Patterns to follow:** existing `crmFetch` + `getReportListing`/`listAllListings`
in `src/lib/crm-client.ts`.
**Test scenarios:**
- success → `{ ok: true }` with stored record.
- 401 / non-200 / missing config → typed failure, no throw.
- network timeout → typed failure.
**Verification:** client tests cover success and each failure mode against mocked
responses; no token in client bundles.

### U6. [APP] Write `approved` record on approve

**Goal:** Approving a weekly report writes an `approved` sent-report to the CRM,
non-blocking.
**Requirements:** R1, R5; KTD3, KTD4, KTD5. Covers F1.
**Dependencies:** U5.
**Files:** `src/app/api/weekly-drafts/[id]/approve/route.ts`,
`src/lib/weekly-drafts.ts` (`approveWeeklyDraft` or a thin post-approve hook),
test alongside (`src/lib/weekly-drafts.test.ts` or a route test).
**Approach:** After a successful approve, resolve the property address and call
`recordSentReport({ address, weekEnding, status: 'approved', approvedBy,
approvedAt, portalUrl })`. Wrap so a CRM failure is logged and swallowed — the
approve response is unchanged (KTD4). `portalUrl`/`approvedBy` from existing
draft/token data.
**Patterns to follow:** `enrichDraftFromCrm` call-site style in
`src/lib/weekly-drafts.ts` (resolve-then-call, graceful).
**Test scenarios:**
- approve with CRM up → `recordSentReport` called with `status=approved` + week +
  portal URL. Covers AE1.
- approve with CRM down/unresolved → approve still succeeds; failure logged.
  Covers AE4, AE5.
- approve does not send `sentAt`/recipient (those belong to the send step).
**Verification:** approve route still returns success regardless of CRM outcome;
the write carries the right `approved` payload when CRM is reachable.

### U7. [APP] Stamp `sent` on send to owner

**Goal:** Sending the report to the owner updates the same record to `sent` with
recipient + sent-at.
**Requirements:** R2, R5; KTD3, KTD4, KTD7. Covers F2.
**Dependencies:** U5, U6.
**Files:** `src/app/api/vendor/notify/route.ts` (and the landlord/notify path if
separate), test alongside.
**Approach:** After a successful notify send, call `recordSentReport({ address,
weekEnding, status: 'sent', sentAt, recipientName, recipientEmail,
channel: 'email', portalUrl })` — the upsert merges onto the existing `approved`
row (KTD3). Non-blocking (KTD4). `weekEnding` derived the same way the draft does
(`getReportWeekEnding`/draft week). If a report is sent without a prior approve
record, the upsert still creates the row in `sent` state.
**Patterns to follow:** existing notify send + the U6 write call.
**Test scenarios:**
- send after approve → existing row updated to `sent` with recipient + sentAt +
  channel, `approvedAt` preserved. Covers AE2.
- send with CRM down → email still sends; CRM failure logged. Covers AE4.
- send without prior approve record → row created in `sent` state (no crash).
**Verification:** notify still sends regardless of CRM outcome; the `sent` payload
merges correctly when reachable.

### U8. [APP][CRM] Config, docs, and end-to-end verification

**Goal:** Document env/auth and verify the lifecycle end-to-end.
**Requirements:** D1, KTD2.
**Dependencies:** U3, U4, U6, U7.
**Files:** `.env.example` (APP — confirm `CRM_API_BASE_URL`,
`WEEKLY_REPORT_API_TOKEN` cover the write), `CLAUDE.md` (APP — note the
sent-report write-back as the one sanctioned write), CRM docs for the new endpoint
if a docs file exists.
**Approach:** No new logic. Confirm the reused key authorises the write on the CRM
side; document the endpoint. Run the end-to-end verification below.
**Test scenarios:** `Test expectation: none -- docs/config; covered by end-to-end
verification.`
**Verification:** see Verification section.

---

## Scope Boundaries

### In scope
- CRM `SentReport` model + migration, DAL, authenticated upsert endpoint, and the
  listing-view history surface.
- App writes on approve and on send, server-side, non-blocking, address-keyed.

### Deferred to Follow-Up Work
- **Write-scoped consumer key** (split read vs write) — hardening once the write
  path is proven (KTD2 trade-off).
- **Dedicated reconciliation job/UI** beyond upsert-on-next-write — revisit if
  unresolved writes prove common (origin Q3).
- **Rendered-report snapshot** storage and **owner-facing report history** —
  origin deferred items; the `SentReport` schema leaves room for a snapshot ref.
- **Structured report data** (stats/commentary) as queryable CRM records.

### Outside this product's identity
- The app **ingesting stats** or market/VaultRE/portal data into the CRM — the CRM
  solely owns ingestion (origin). This sent-report write is the only sanctioned
  exception.
- Auto-approving or auto-sending without agent review.

---

## Dependencies & Assumptions

- **D1 (producer-side, sequencing)** The CRM units (U1–U4) ship before the app
  writes are useful end-to-end; the app units (U5–U7) can be built/tested against
  a mocked endpoint in parallel.
- **A1** The `weekly-report` Bearer key authorises the new write on the CRM
  (KTD2); `CRM_API_BASE_URL` + `WEEKLY_REPORT_API_TOKEN` set on the app host.
- **A2** Property/rental address text resolves in the CRM (`resolveListing`); where
  it doesn't, the write is logged for reconciliation (KTD5).
- **A3** Recipient identity and portal URL are available at approve/send time from
  existing draft + token metadata.

---

## Risks

- **Shared read+write key blast radius** — reusing the `weekly-report` key for the
  write widens what a leaked key can do. Mitigate: server-side only (KTD6);
  write-scoped key deferred as hardening.
- **Address-resolve misses** — an unresolved address means no record until
  reconciled. Mitigate: log + upsert-on-next-write (KTD3/KTD5); surfaces as a gap,
  not a crash.
- **Partial-update clobbering** — a send upsert must not wipe approve fields (or
  vice-versa). Mitigate: merge semantics in `upsertSentReport`, covered by U2/U7
  tests.
- **Non-blocking write hides failures** — silent CRM failures could accumulate.
  Mitigate: log every failed write; reconcile-job deferred but flagged.

---

## Verification

1. **CRM unit:** `npm test` (vitest) — `sent-reports` DAL + endpoint tests pass;
   existing report tests unaffected.
2. **APP unit:** `npx tsc --noEmit` clean; `crm-client` + approve/notify hook
   tests pass against mocked CRM.
3. **End-to-end (against a CRM with the endpoint live):** approve a draft →
   `POST /api/report/sent-reports` records `approved`; send to owner → same row
   becomes `sent` with recipient; the CRM listing view shows one history entry for
   the week; re-approve/re-send keeps it at one row.
4. **Degradation:** with the CRM unreachable, approve and send still succeed and a
   failure is logged (no duplicate, no crash).
