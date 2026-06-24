---
title: Store sent weekly reports back in GEA_crmAI (sent-report log)
date: 2026-06-23
status: ready for planning
type: requirements
scope: Deep — feature
repos:
  consumer: GEA_ST_reports_weeklycampaign_vendor (this repo)
  producer: GEA_crmAI
---

# Store sent weekly reports back in GEA_crmAI (sent-report log)

## Problem Frame

The weekly report app now *reads* its data from GEA_crmAI, but nothing flows
back. Once an agent approves a weekly report and it reaches the owner, there is
**no record in the CRM** that it happened. An agent looking at a listing in the
CRM can't see whether this week's report went out, when, or to whom — that
history lives only as draft JSON in the report app's iCloud markdown store, which
isn't visible from the CRM and isn't a durable office record.

The pain is **missing report-history at the listing level in the system of
record**. The value is a lightweight, reliable trail an agent sees inline on the
listing: which weekly reports were approved and sent, when, and to which owner.

## Key Decision — a narrow write-back exception (resolved)

The prior data-architecture decision made this app a **pure read consumer** of
the CRM, with the CRM owning all ingestion (see origin:
`docs/brainstorms/2026-06-16-multi-source-weekly-report-data-requirements.md`).
This feature introduces **exactly one write** from the report app to the CRM: a
**sent-report record**. This is a deliberate, scoped exception:

- It is **report-comms metadata** (the app recording its own action), not
  market/stat **ingestion** — the CRM still solely owns stat/VaultRE/portal
  ingestion.
- The CRM remains the **system of record**; the report app pushes a small,
  well-defined record to it, keyed to the listing.

Rationale: the alternative (CRM pulling from the report app, or the report app
holding the only copy) either reverses the CRM's system-of-record role or leaves
the history invisible where agents actually work — the listing view in the CRM.

## Actors

- **A1 — Agent** (Grants Estate Agents sales/leasing agent): approves and sends
  the weekly report; later views a listing's report history in the CRM.
- **A2 — Owner** (vendor / landlord): receives the report; does not interact with
  the log.
- **A3 — GEA_crmAI** (system): system of record; stores the sent-report log and
  surfaces it on the listing.
- **A4 — Weekly report app** (system): writes the sent-report record on approve
  and on send.

## Goals & Success Criteria

- **G1** An agent viewing a listing in the CRM can see its weekly-report history
  inline. Success: the listing shows a list of weekly reports with week-ending,
  approved-by/at, sent-at, and recipient.
- **G2** The record reflects the true lifecycle. Success: approving creates the
  entry; sending stamps it with sent-at + recipient, without creating a duplicate.
- **G3** Recording never disrupts the agent's core actions. Success: if the CRM
  write fails, approve and send still succeed, and the record is reconciled later.
- **G4** One report per listing per week. Success: re-approving or re-sending the
  same week updates the existing record rather than adding rows.

## Requirements

- **R1** On **approve** of a weekly report, the app writes a sent-report record to
  the CRM for that listing: week-ending, approved-by, approved-at, status
  `approved`, and the owner portal link.
- **R2** On **send** to the owner, the app updates the same record with sent-at,
  recipient (owner name/email), and status `sent`.
- **R3** The record is keyed to a CRM listing (resolved by address, mirroring the
  read path) and to the week-ending date; the pair `(listing, week-ending)` is
  unique — repeated approve/send **updates**, never duplicates (G4).
- **R4** The CRM stores these records and **surfaces them on the listing view**
  so an agent sees the report history inline (G1).
- **R5** The CRM write is **non-blocking and best-effort**: a failure must not
  block approve or send; failures are logged and reconciled (retry on next
  approve/send of that listing, or a manual/scheduled reconcile) (G3).
- **R6** The write is authenticated with the app's existing per-consumer Bearer
  key and happens **server-side** (the token never reaches the browser).
- **R7** The record stores a **link/reference** to the report (the owner portal
  URL), not the rendered document — snapshot storage is out of scope (see Scope).

## Key Flows

- **F1 — Approve creates the record**: agent approves a draft → app resolves the
  listing in the CRM and writes a sent-report record (`approved`). (Covers G1,
  G2, R1, R3.)
- **F2 — Send stamps delivery**: agent sends the report to the owner (notify
  email) → app updates the record with sent-at + recipient (`sent`). (Covers G2,
  R2.)
- **F3 — Agent reviews history in the CRM**: agent opens the listing in the CRM →
  sees the list of weekly reports with their lifecycle metadata. (Covers G1, R4.)
- **F4 — Degraded write**: CRM unreachable on approve/send → core action still
  completes; record is queued/retried and reconciled later. (Covers G3, R5.)

## Acceptance Examples

- **AE1** Agent approves this week's report for a listing with no prior record →
  a new sent-report entry appears on that listing in the CRM with week-ending,
  approved-by, approved-at, status `approved`. (R1, R3, R4)
- **AE2** Agent then sends the report to the owner → the **same** entry now shows
  sent-at + recipient and status `sent` — no second row. (R2, R3, R4)
- **AE3** Agent re-approves (or re-sends) the same week → the existing entry is
  updated; the listing still shows one entry for that week. (R3, G4)
- **AE4** The CRM is down when the agent approves → approval still succeeds in the
  report app; the record is created/updated on a later successful write, not lost.
  (R5, G3)
- **AE5** A listing whose address doesn't resolve in the CRM → approve/send still
  succeed; the unresolved write is flagged for reconciliation, not silently
  dropped. (R3, R5)

## Scope Boundaries

### In scope
- A CRM-side **sent-report storage model** keyed to a listing + week-ending, with
  the lifecycle fields (approved-by/at, sent-at, recipient, status, portal link).
- An authenticated **CRM write endpoint** to upsert a sent-report record.
- A **listing-view surface** in the CRM showing the report history inline.
- The report app writing the record **on approve and on send**, server-side,
  non-blocking.

### Deferred for later
- Storing the **rendered report snapshot** (PDF/HTML of exactly what the owner
  saw) — set aside in favour of a lightweight log.
- **Owner-facing report history** (showing owners their past reports).
- Storing the report's **structured data** (stats/commentary) as queryable CRM
  records for trends.
- A dedicated **reconciliation UI/job** beyond retry-on-next-write (revisit if
  unresolved writes prove common).

### Outside this product's identity
- The report app **ingesting stats** or any market/VaultRE/portal data into the
  CRM — the CRM still solely owns ingestion. This feature is the *only* sanctioned
  write, and only for report-comms metadata.
- Auto-approving or auto-sending reports without agent review.

## Dependencies & Assumptions

- **D1 (producer-side, blocking)** GEA_crmAI must add the sent-report storage
  model, the authenticated upsert endpoint, and the listing-view surface. Until
  then the consumer write has no target.
- **D2** The app can resolve a listing to a CRM id by address (the existing
  `GET /api/report/resolve` path). Unresolved addresses are handled per R5.
- **A-assume1** "Send to owner" is the existing notify path
  (`src/app/api/vendor/notify/route.ts`); the send-side update (R2) hooks there.
  If owners are sometimes reached by manually copying the portal link, those sends
  won't stamp `sent-at` — acceptable; the `approved` record still exists.
- **A-assume2** The CRM will accept the app's existing `weekly-report` consumer
  key for this write (or issue a write-scoped key); per-consumer auth pattern
  reused.
- **A-assume3** Recipient identity (owner name/email) is available at send time
  from the token/owner metadata already used by the notify route.

## Open Questions

- **Q1** Does the CRM reuse the existing `weekly-report` read key for this write,
  or issue a separate write-scoped consumer key? (Auth surface; producer call.)
- **Q2** Where exactly should the sent-report record attach in the CRM data model
  — directly on the listing, or via a comms/activity log linked to it? (Producer
  data-modelling; affects the listing-view surface.)
- **Q3** What is the reconciliation trigger for failed writes — retry on the next
  approve/send of that listing, a scheduled sweep, or an agent-visible flag?
  (Resolves the R5 mechanism; default: retry-on-next-write.)
- **Q4** Should the record capture *which* channel delivered it (email vs copied
  link) for a fuller audit, or is sent-at/recipient enough for now?

## Approaches Considered

- **Report app pushes a sent-report record to a CRM write endpoint (chosen).**
  Narrow, explicit write; keeps the CRM as system of record and surfaces history
  where agents work. Cost: a cross-repo write contract and a small reversal of the
  pure-consumer stance (scoped to comms metadata).
- **CRM pulls report state from the report app.** Avoids a write from the app, but
  requires the CRM to reach into the report app's draft store (which is iCloud
  markdown, not a service) — higher coupling, worse fit. Rejected.
- **Keep the history only in the report app.** Lowest effort, but the history
  stays invisible from the CRM listing view — fails the core goal (G1). Rejected.
- **Store the rendered snapshot now (challenger, higher-upside).** A durable
  re-openable archive of exactly what was sent. More build + storage; the log
  delivers the stated value first. Deferred, not rejected — the log's schema
  should leave room to add a snapshot reference later.

## Sources & Research

- This repo — `src/app/api/weekly-drafts/[id]/approve/route.ts` (approve flow),
  `src/lib/weekly-drafts.ts` (`approveWeeklyDraft`),
  `src/app/api/vendor/notify/route.ts` (send-to-owner email + portal link),
  `src/lib/vendor-tokens.ts` / `src/lib/rental-tokens.ts` (token→listing keying).
- Origin architecture — `docs/brainstorms/2026-06-16-multi-source-weekly-report-data-requirements.md`
  (pure-consumer decision this feature scopes an exception to),
  `docs/plans/2026-06-19-001-feat-crm-report-consumer-plan.md` (read-API client + auth pattern to reuse).
- GEA_crmAI — `src/app/api/report/*` (existing read endpoints, auth via
  `verifyApiKey`, CORS pattern) as the template for the new write endpoint.
