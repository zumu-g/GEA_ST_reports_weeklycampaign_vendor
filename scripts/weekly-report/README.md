# Weekly Campaign Update Report Generator

Parameterised generator for vendor (owner) weekly campaign updates.

```
inputs (week, portal PDFs/stats, open-home figures, agent comment)
  → formatted owner-facing report (Markdown) + delivery-ready email draft
```

Generation only — **nothing is sent**. The email draft is written to disk and the
send step is deliberately stubbed for an approval workflow.

## Run

```bash
node scripts/weekly-report/generate.mjs scripts/weekly-report/sample-input.json
# optional: --out <dir>   (default: scripts/weekly-report/output)
```

Zero-install: plain ESM, runs on `node` directly. PDF parsing uses the repo's
`pdf-parse` dependency (loaded via `createRequire`).

## Inputs (`<input>.json`)

| Field | Notes |
|---|---|
| `week` | Campaign week number — drives the narrative block (1, 2, 3, 4, 5+). |
| `propertyAddress`, `vendorName`, `agent`, `weekEnding` | Required. |
| `askingPrice`, `vendorEmail` | Optional. |
| `portals.rea` / `portals.domain` | Each is `null` (missing → alert) or one of `{ pdfPath }`, `{ rawText }`, `{ stats: { views, enquiries, saves, reveals } }`. |
| `previousWeek` | `{ views, enquiries }` — drives week-on-week deltas + alerts. |
| `openHome` | `{ groups, previousGroups, privateInspections, names: [] }`. |
| `agentComment` | Free-text agent note appended to the report. |
| `priceReviewLogged`, `ownerApprovedRange`, etc. | Drive checklist + alert state. |
| `checklist` | Per-item boolean overrides keyed by item key. |

## What it produces

- **Campaign-week-aware narrative** — Week 1 setup · 2 momentum · 3 qualification ·
  4 price-range review · 5+ strategy options.
- **Online performance** — per-portal table (REA / Domain / combined) with views,
  enquiries, saves, reveals, plus comparison-to-similar where present. Missing portal
  reports are handled gracefully.
- **"We Do / You Do" checklist** — two columns, done/outstanding state driven by data.
- **Agent comment**, and an **internal alerts** block (views down, high-views/zero-enquiries
  price signal, open-home decline, week-4-no-price-review, missing portal report).
- **Email draft** (`*.email.txt`) — delivery-ready, not sent.

## Files

| File | Role |
|---|---|
| `generate.mjs` | Pipeline + CLI + rendering. Exports `generate(input)`. |
| `parse-portal.mjs` | PDF/text → stats extraction (handles missing portal). |
| `narrative.mjs` | Campaign-week narrative blocks. |
| `checklist.mjs` | We Do / You Do checklist, data-driven state. |
| `alerts.mjs` | Auto-flag alert rules. |
| `sample-input.json` | Test data (Week 4, REA present, Domain missing). |

## Template basis

No standalone letter template exists in the repo. The report matches the established
GEA structure and warm "trusted-advisor" tone from
`src/app/api/generate-report/route.ts` (the `GeneratedReportNarrative` shape) and the
`content/guides/` voice. Narrative is deterministic (no AI call) so runs work offline
without `MINIMAX_API_KEY`; the in-app AI drafting remains available separately.
