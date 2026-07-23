---
title: "fix: Portal property set driven by live GEA CRM listings"
date: 2026-07-23
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
plan_type: fix
---

# fix: Portal property set driven by live GEA CRM listings

## Summary

The properties shown across the portal — admin dashboard, weekly draft generation, article broadcasts, Telegram shorthand resolution, and vendor-facing portal pages — should be exactly the *live* listings in the GEA CRM (GEA_crmAI's `getActiveListings` set). Today only the admin dashboard is CRM-aware, and it silently falls back to local markdown folders when the CRM is unreachable (which it currently always is locally: `CRM_API_BASE_URL` points at `localhost:3100` where nothing listens). Everything else is driven by whatever folders exist in `PROPERTIES_DIR`, including stale/TBC properties. This plan introduces a single live-property-set resolver that reconciles CRM live listings with local markdown folders (auto-creating missing folders, hiding non-live ones without deleting files) and points every consumer at it.

**User decisions (2026-07-23):** Full sync — CRM drives the property set everywhere. Non-live properties are *hidden*, never deleted: markdown stays the permanent record.

---

## Problem Frame

Two property lists exist and disagree:

1. **CRM live listings** — `crm-client.ts` `listAllListings()` → `GET {CRM_API_BASE_URL}/api/report/listings`, which returns the agency's active listing set with stats. Used only by `src/app/page.tsx`, only when `isCrmConfigured()`, and silently abandoned on any failure.
2. **Local markdown folders** — `getAllProperties()` in `src/lib/markdown-loader.ts` globs `PROPERTIES_DIR`. Drives `generate/page.tsx`, `/api/properties`, all of `weekly-drafts.ts` (draft generation, `getAllWeeklyDrafts`, `broadcastArticleToAllDrafts`), and — via slug-keyed vendor tokens — every vendor portal page. A third, hardcoded copy lives in `src/lib/property-registry.ts` (Telegram keyword map).

There is no linkage field between the two: `PROPERTY.md` stores no CRM/Vault listing id, so matching must start from addresses.

---

## Requirements

- R1: A single server-side resolver produces the canonical live property set: CRM live listings matched to local folder slugs.
- R2: A CRM live listing with no matching local folder gets a markdown folder auto-created from the property template, so drafts/broadcasts/portals work for it immediately.
- R3: A local folder whose listing is not in the CRM live set is hidden from the dashboard, weekly draft generation, broadcasts, and its vendor URL — files untouched.
- R4: When the CRM is configured but unreachable, consumers fall back to the local markdown set **loudly**: the dashboard shows a visible source/warning banner instead of silently rendering stale data.
- R5: `PROPERTY.md` records the CRM listing id once matched, making future matching stable against address-format drift.
- R6: The Telegram/WhatsApp property keyword resolver derives from the live set instead of the hardcoded `PROPERTY_REGISTRY` map.
- R7: Local dev config points `CRM_API_BASE_URL` at the actually-running crmAI instance.

---

## Key Technical Decisions

**KTD1 — One resolver module, CRM-first with explicit-fallback result.** New `src/lib/live-properties.ts` exposing something like `getLivePropertySet(): Promise<{ properties: LiveProperty[]; source: 'crm' | 'markdown-fallback'; crmError?: string }>`. Consumers never call `listAllListings()` + `getAllProperties()` separately; they get one reconciled answer plus provenance. Returning the fallback state (rather than throwing or silently degrading) is what makes R4's loud fallback possible everywhere.

**KTD2 — Match by stored id first, then normalised address.** Matching order per CRM listing: (1) a `CRM Listing ID` value parsed from `PROPERTY.md` Property Details; (2) normalised-address comparison (lowercase, strip state/postcode/punctuation, compare street+suburb tokens) against each folder's address heading. On first successful address match, write the listing id back into `PROPERTY.md` (R5) so subsequent runs use the stable id. Follows the existing Property Details bullet-list format.

**KTD3 — Auto-create folders via the existing template path.** When a CRM live listing matches no folder, create `properties/{slug}/` using the same scaffolding as `/api/properties/create` (reuse its internals — extract a `createPropertyFromDetails()` helper if currently route-locked, don't duplicate). Slug derived from address per the repo convention: lowercase street-suburb, hyphens, no state/postcode. Owner/price/agent fields populated from the CRM listing DTO; missing fields left as template defaults.

**KTD4 — Hiding is filtering, not writing.** Non-live folders are simply excluded from the resolver's returned set. No archive move, no status file. The vendor page (`src/app/vendor/[token]/page.tsx`) checks membership in the live set and renders a "campaign not active" state instead of the report when the property is hidden. In markdown-fallback mode (CRM down), nothing is hidden — availability of stale data beats over-hiding when the source of truth is unreachable.

**KTD5 — Per-request resolution, no cache layer.** The listing count is tens at most; the CRM route already tolerates per-listing queries. `force-dynamic` pages resolve fresh per request, matching the repo's existing no-cache posture (`getProperty` freshness test). Use React `cache()` for intra-request dedupe only if profiling shows repeated calls in one render.

**KTD6 — CRM API surface unchanged.** `GET /api/report/listings` already returns exactly the live set (whole-agency by design). No GEA_crmAI changes in this plan.

---

## High-Level Technical Design

```
                    ┌────────────────────────────────────┐
                    │  live-properties.ts                │
                    │  getLivePropertySet()              │
                    │                                    │
  crm-client        │  1. listAllListings()  ──ok──►     │
  listings ───────► │  2. match each listing to folder   │
                    │     (stored id → normalised addr)  │
  markdown-loader   │  3. no folder? auto-create (KTD3)  │
  getAllProperties ►│  4. write back CRM Listing ID      │
                    │  5. return live set + source       │
                    │                                    │
                    │  CRM fail ──► markdown set +       │
                    │     source:'markdown-fallback'     │
                    └───────────────┬────────────────────┘
                                    │
        ┌──────────────┬────────────┼──────────────┬─────────────────┐
        ▼              ▼            ▼              ▼                 ▼
   page.tsx      generate/     /api/properties  weekly-drafts   vendor/[token]
   (dashboard    page.tsx                       generateAll /   (hide non-live:
    + banner)                                   broadcast       "campaign not
                                                                 active" state)
                                    │
                                    ▼
                          property-registry.ts
                          (keyword map derived from live set)
```

---

## Scope Boundaries

**In scope:** Sales listings; the reports/portal repo only.

### Deferred to Follow-Up Work
- Rentals (`rental-loader.ts`) — separate loader, no CRM rental endpoint yet.
- Archiving/moving stale folders (user chose hide-not-move; revisit if the properties dir gets noisy).
- GEA_crmAI-side changes (webhook push on listing status change would beat polling — not needed at current scale).
- Vendor-token auto-generation for auto-created properties (tokens are created via the existing `/api/vendor/tokens` flow; auto-creating them here would silently mint vendor-facing URLs).

---

## Implementation Units

### U1. Live property set resolver

**Goal:** One module reconciling CRM live listings with local folders, returning the canonical set plus provenance.

**Requirements:** R1, R3 (filtering), R4 (fallback state), R5 (id write-back)

**Dependencies:** none

**Files:**
- `src/lib/live-properties.ts` (new)
- `src/lib/live-properties.test.ts` (new)
- `src/lib/markdown-loader.ts` (parse + write `CRM Listing ID` in Property Details)

**Approach:** Per KTD1/KTD2/KTD5. `LiveProperty` carries `{ slug, listing: CrmListing, property: PropertyData | null }`. Address normalisation as a small pure exported function (easily unit-tested). Id write-back reuses the Property Details bullet format; tolerate the field being absent or already present.

**Patterns to follow:** `crm-client.ts` CrmResult never-throw style; `weekly-drafts.ts` graceful-degrade posture; `appendMarketNews` for surgical PROPERTY.md edits.

**Test scenarios:**
- Happy path: 2 CRM listings, 2 matching folders (one by stored id, one by address) → both in set, `source: 'crm'`, address-matched folder gains `CRM Listing ID`.
- Address normalisation: "85 Centenary Boulevard, Officer South VIC 3809" matches folder heading "85 Centenary Boulevard, Officer South VIC 3809" and variant "85 Centenary Blvd, Officer South".
- Non-live folder: 3 folders, CRM returns 2 → third excluded from set (files untouched).
- CRM unreachable: `listAllListings` errors → full markdown set returned, `source: 'markdown-fallback'`, `crmError` populated, nothing hidden.
- CRM returns empty list (`ok`, zero listings): treat as valid — empty live set, not fallback. (Deliberate: an agency with nothing listed should show nothing.)
- Stored id no longer in live set + address also unmatched → folder hidden, id left in place.

**Verification:** Unit tests pass; calling the resolver against the real local `PROPERTIES_DIR` with CRM down returns all folders flagged as fallback.

---

### U2. Auto-create folders for unmatched CRM listings

**Goal:** A live CRM listing with no local folder gets one scaffolded from the template so every downstream feature works for it.

**Requirements:** R2

**Dependencies:** U1

**Files:**
- `src/lib/live-properties.ts` (creation step)
- `src/app/api/properties/create/route.ts` (extract reusable creation helper if needed)
- `src/lib/live-properties.test.ts`

**Approach:** Per KTD3. Slug from address via the repo's slug convention (guard with existing `assertSafeSlug`). Populate owner (vendorName), price guide, listed date, agent from the CRM DTO; write `CRM Listing ID` at creation. Creation is idempotent — re-running the resolver never duplicates.

**Test scenarios:**
- CRM listing with no folder → folder created with PROPERTY.md carrying address, owner, price, `CRM Listing ID`; appears in returned live set.
- Idempotency: resolver run twice → one folder, no duplicate sections.
- Address that would slugify into an existing (non-matching) slug → creation refused, listing surfaced in a `conflicts` field rather than silently overwriting. 
- Malformed address (empty street) → listing skipped with a recorded warning, not a crash.
- Integration: after auto-creation, `getProperty(slug)` loads the new folder successfully.

**Verification:** Temp-dir fixture tests; on-disk PROPERTY.md matches the template shape used by `/api/properties/create`.

---

### U3. Point all consumers at the live set

**Goal:** Dashboard, generate page, properties API, weekly draft generation, and article broadcasts all operate on the resolver's set.

**Requirements:** R1, R3, R4

**Dependencies:** U1 (U2 for full behaviour)

**Files:**
- `src/app/page.tsx` (replace dual CRM/markdown branching with resolver + source banner)
- `src/app/generate/page.tsx`
- `src/app/api/properties/route.ts`
- `src/lib/weekly-drafts.ts` (`generateAllWeeklyDrafts`, `getAllWeeklyDrafts`, `broadcastArticleToAllDrafts` iterate the live set)
- `src/lib/broadcast-article.test.ts` (update fixtures)

**Approach:** Mechanical redirection: where `getAllProperties()` enumerates the working set, substitute the resolver's slugs. Dashboard keeps rendering CRM stats via `crmReportToVendorReport` when `source: 'crm'`. The mock-data last resort remains for a truly empty environment. Banner: a small strip on the dashboard when `source: 'markdown-fallback'` — "CRM unreachable ({error}) — showing local data" (R4).

**Test scenarios:**
- Broadcast with one non-live folder present → article lands only in live properties' drafts.
- `generateAllWeeklyDrafts` skips non-live folders and includes an auto-created one.
- Dashboard render logic: fallback source → banner present; crm source → no banner (component/unit level).
- Existing weekly-draft and broadcast tests still green after fixture updates.

**Verification:** Full suite green; local run with CRM up shows only live listings; with CRM down shows all folders plus banner.

---

### U4. Hide non-live vendor portal pages

**Goal:** A vendor URL for a non-live property shows a "campaign not active" state instead of the report; live and fallback modes unaffected.

**Requirements:** R3

**Dependencies:** U1

**Files:**
- `src/app/vendor/[token]/page.tsx`
- `src/components/vendor/CampaignInactive.tsx` (new, simple)

**Approach:** Per KTD4. After token→slug resolution, check membership in the live set. Non-live → render the inactive state (address + agent contact line, no stats). `source: 'markdown-fallback'` → render normally (never hide on CRM outage). Keep the existing 404 for invalid tokens.

**Test scenarios:**
- Live slug → report renders as today.
- Non-live slug → inactive state, no analytics/messages sections.
- CRM down → non-live slug still renders the full report (fail-open).
- Invalid token → 404 unchanged.

**Verification:** Route-level tests for the three states; manual check of one live and one stale property locally.

---

### U5. Derive Telegram/WhatsApp keyword registry from the live set

**Goal:** `resolveProperty()` matches against live properties (street number + street name + suburb keywords generated from each address) instead of the hardcoded map.

**Requirements:** R6

**Dependencies:** U1

**Files:**
- `src/lib/property-registry.ts` (rewrite as derivation over the live set; keep the exported signature used by the Telegram/WhatsApp routes)
- `src/lib/property-registry.test.ts` (new)

**Approach:** Generate keyword candidates from each live property's address (e.g. "85 centenary", "officer south", street name alone when unambiguous). Ambiguous keyword (two live listings share a suburb) → suburb keyword maps to nothing; street-number keywords stay unique. The function becomes async (needs the live set) — update its two route callers.

**Test scenarios:**
- "85 centenary open 5 groups" resolves to the live slug.
- Suburb keyword shared by two live listings → returns null (forces more specific input).
- Property that left the live set no longer resolves.
- Fallback mode → registry derives from markdown set (Telegram ingest keeps working during CRM outage).

**Verification:** Unit tests plus existing telegram route tests green with the async change.

---

### U6. Local config fix + env documentation

**Goal:** Local dev actually reaches the CRM; the env contract documents the port expectation.

**Requirements:** R7

**Dependencies:** none

**Files:**
- `.env.example` (document `CRM_API_BASE_URL` including the crmAI dev port)
- `.env.local` (local-only, gitignored — set to the running crmAI port)

**Approach:** Confirm which port GEA_crmAI dev actually binds (its `dev` script / docs), point `CRM_API_BASE_URL` there, verify `WEEKLY_REPORT_API_TOKEN` matches a consumer key on the crmAI side.

**Test scenarios:** Test expectation: none — pure config. Verification is the runtime smoke check below.

**Verification:** `curl` the listings endpoint with the configured token returns the live set; dashboard renders `source: 'crm'` with no banner.

---

## Verification Contract

- All unit/route tests (U1-U5) pass alongside the existing suite.
- End-to-end with CRM up: dashboard lists exactly the CRM live set; a CRM listing without a folder appears with an auto-created folder; a stale local folder is absent from dashboard, drafts, broadcasts, and shows "campaign not active" at its vendor URL.
- End-to-end with CRM down: dashboard shows all local folders plus the fallback banner; vendor pages fail open; Telegram ingest still resolves properties.
- Article broadcast (existing feature) reaches only live properties when CRM is up.

## Definition of Done

- U1-U6 landed and tested.
- The property set rendered anywhere in the portal equals the GEA CRM live listing set whenever the CRM is reachable, with loud, fail-open fallback when it is not, and no property files deleted or moved.
