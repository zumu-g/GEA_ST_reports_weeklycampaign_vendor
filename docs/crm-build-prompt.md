# CRM build prompt — make the weekly-report read API serve real data

Paste the block below into a Claude Code session **opened in the GEA_crmAI repo**.

Context: the read-API contract is shipped (auth, resolver, gap-aware stats
endpoint, `vaultExternalId` keying), but a 2026-06-18 audit found the pipes exist
with no water. Decision (consuming team): the **CRM owns all ingestion**; the
weekly-report app is a pure read consumer. This prompt builds the writers + fills
payload gaps. See `docs/brainstorms/2026-06-16-multi-source-weekly-report-data-requirements.md`
for the full consumer-side context.

---

```
/ce-plan Make the weekly-report read API actually serve real data. The read-API
contract is already shipped (auth, resolver, gap-aware stats endpoint,
vaultExternalId keying) — but a 2026-06-18 audit found the pipes exist with no
water: every stat returns gap:true in production, there's no VaultRE sync, and
sales inspections aren't modelled. Decision from the consuming team: the CRM owns
ALL ingestion (the downstream weekly-report app is a pure read consumer and will
NOT write stats in). Build the writers and fill the payload gaps.

Re-verify current state against live code first, then plan/build these items:

1. VaultRE sync (biggest blocker). Add a VaultRE API client + ingestion
   (Inngest job and/or webhook) that populates Listing rows and sets
   vaultExternalId, writing to the existing sync_log / GET /api/admin/sync/status
   scaffold. Wire VAULTRE_* env vars (key is issued; the API token is pending —
   make it config-driven and fail gracefully if unset). Without this the
   resolver mostly 404s.

2. Portal-stat writers with REA/Domain split. CampaignStat schema exists but
   recordStatCapture is test-only. Add a production writer that captures
   views/enquiries/saves/searchAppearances per portal as separate rows
   (source:'rea' and source:'domain'), append-only with capturedAt, so the report
   can show REA vs Domain separately and freshness is real. Source the numbers
   via whatever ingestion the CRM owns (VaultRE portal-stats retrieval and/or
   portal scraping) — that acquisition method is itself a key decision to resolve.

3. Sales inspection / open-home data. Model sales open-home attendees + private
   inspection counts (distinct from the PM tenancy module) and expose them on the
   report listings endpoint with the same {value, source, capturedAt, gap} shape.

4. Property payload completeness. Add to GET /api/report/listings/{id}: price
   guide, listed date, days on market, agent, and vendor name (resolve
   ownerContactId → contact name). Carry per-field source/last-updated where
   feasible.

5. Confirm WEEKLY_REPORT_API_TOKEN is set in Railway production env (only a
   placeholder locally today).

Build on the existing docs in this repo — verify the code matches and extend:
- docs/brainstorms/2026-06-16-crm-weekly-report-read-api-requirements.md
- docs/plans/2026-06-16-006-feat-crm-read-api-weekly-report-plan.md
- docs/plans/2026-06-16-004-feat-vaultre-feature-parity-roadmap-plan.md

Keep the shipped read-API response shape stable (the consumer depends on the
{value, source, capturedAt, gap} per-metric contract). Flag any change that would
break it.
```

---

When that work lands, return to this repo for **Track 2** — wiring the report to
consume the live data (CRM client, `resolve → listings` flow, gap-aware
rendering, retire direct VaultRE).
