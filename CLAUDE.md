# GEA Weekly Campaign & Vendor Report Dashboard

## Project Overview
Dashboard for **Grants Estate Agents (GEA)** to create weekly campaign reports for property vendors (sellers) and landlords (rental listings). Built with Next.js + Tailwind CSS.

## Business Context
- GEA agents compile weekly stats from realestate.com.au, domain.com.au, and open home attendance
- Reports are created internally but shared with vendor/landlord clients (online dashboard + PDF)
- Vendors and landlords can view their campaign performance via a token-gated portal
- Rental listings have a parallel `/landlord/` namespace mirroring the `/vendor/` flow

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS 4
- **AI**: MiniMax M2.5 (`MINIMAX_API_KEY` in `.env.local`) — report generation, commentary drafting, market news, PDF stat extraction
- **Data**: Markdown files under `GEA_vendor_portal/properties/{slug}/` (sales) and `GEA_vendor_portal/rentals/{slug}/` (rentals)
- **Repo**: https://github.com/zumu-g/GEA_ST_reports_weeklycampaign_vendor.git

## Project Structure
```
src/
  app/
    page.tsx                            # Agent dashboard — all listings summary
    layout.tsx                          # Root layout with GEA branding + PWA meta
    globals.css                         # Theme variables + Tailwind 4 @theme inline
    generate/
      page.tsx                          # 7-step report wizard (sales)
      rental/page.tsx                   # Rental report wizard
    report/[id]/page.tsx                # Individual vendor report (agent view)
    vendor/[token]/page.tsx             # Vendor-facing portal (token-gated)
    vendor/[token]/layout.tsx           # Vendor layout
    landlord/[token]/page.tsx           # Landlord-facing portal (token-gated)
    landlord/[token]/layout.tsx         # Landlord layout
    admin/                              # Admin/onboarding pages
    api/
      extract-pdf/route.ts              # POST: PDF → raw text (pdf-parse)
      parse-stats/route.ts              # POST: PDF text → { views, enquiries, saves } via AI
      generate-report/route.ts          # POST: all wizard data → GeneratedReportNarrative (MiniMax)
      generate-report/rental/route.ts   # POST: rental wizard data → rental narrative (MiniMax)
      draft-commentary/route.ts         # POST: stats → agent commentary draft (MiniMax)
      draft-market-news/route.ts        # POST: address/week → 3 market news bullets (MiniMax)
      weekly-drafts/
        generate/route.ts               # POST: create blank drafts for all properties this week
        [id]/route.ts                   # GET/PATCH: fetch or update a draft (PATCH marks agent-edited fields)
        [id]/approve/route.ts           # POST: approve a draft
        [id]/refresh/route.ts           # POST: re-pull CRM data for one draft (keeps agent edits)
      ingest/
        analytics/route.ts              # POST: store portal stats to property markdown
        inspection/route.ts             # POST: store inspection data to property markdown
        telegram/route.ts               # POST: ingest from Telegram bot
      properties/
        route.ts                        # GET: list all properties
        [slug]/route.ts                 # GET: single property data
        create/route.ts                 # POST: create new property markdown
      vendor/
        tokens/route.ts                 # GET/POST: manage vendor access tokens
        campaign-tasks/route.ts         # Vendor campaign task management
        notify/route.ts                 # Vendor notification endpoint
  components/
    Header.tsx                          # GEA branded header/nav (navy, Gloock wordmark)
    StatCard.tsx                        # Reusable metric card (default + hero variant)
    AnimatedNumber.tsx                  # Client-side count-up animation (prefers-reduced-motion aware)
    PropertyCard.tsx                    # Sales listing card on dashboard
    RentalCard.tsx                      # Rental listing card on dashboard
    ShareButton.tsx                     # Copy vendor portal URL to clipboard
    GenerateDraftsButton.tsx            # Create this week's drafts (CRM pre-filled) for all properties
    PortalBreakdown.tsx                 # REA vs Domain stats side-by-side
    Chat.tsx                            # Floating chat widget (UI only — no backend yet)
    ReportWizard.tsx                    # 7-step wizard with file upload + AI generation
    RentalReportWizard.tsx              # Rental report wizard (6 steps)
    InspectionHistory.tsx               # Inspection log component
    vendor/
      VendorHeader.tsx                  # Vendor/landlord portal header
      CampaignChecklist.tsx             # Vendor checklist component
      CampaignTimeline.tsx              # Timeline of campaign milestones
      CommunicationsLog.tsx             # Agent-vendor comms log
      MarketNews.tsx                    # Market news bullets component
      DownloadButton.tsx                # PDF download button
      AppointmentCalendar.tsx           # Inspection appointment display
      DailyQuote.tsx                    # Daily motivational quote
      WelcomeTour.tsx                   # First-time vendor welcome tour
  lib/
    types.ts                            # All TypeScript interfaces
    mock-data.ts                        # Sample data (fallback when no markdown files)
    minimax.ts                          # MiniMax API wrapper (callMiniMax, stripThinking)
    markdown-loader.ts                  # Load property data from markdown files
    rental-loader.ts                    # Load rental data from markdown files
    property-registry.ts                # List/resolve property slugs
    data-adapter.ts                     # Convert markdown props to VendorReport format
    weekly-drafts.ts                    # Draft lifecycle (create, save, approve, CRM enrich/refresh)
    crm-client.ts                       # GEA_crmAI read-API client (resolve + listings)
    crm-draft-mapper.ts                 # Map CRM response -> draft fields (gap-aware, agent edits win)
    vendor-tokens.ts                    # Sales token → slug mapping (JSON file)
    rental-tokens.ts                    # Rental token → slug mapping (JSON file)
    rental-tokens.json                  # Rental token store (gitignored in prod)
    clickup-config.ts                   # ClickUp integration config
    quotes.ts                           # Daily quote data

GEA_vendor_portal/
  properties/
    {slug}/                             # One folder per sales listing
      index.md                          # Property details + metadata
      analytics/                        # Weekly portal stats (markdown tables)
      inspections/                      # Inspection logs
      weekly/                           # Weekly draft JSON files
  rentals/
    {slug}/                             # One folder per rental listing
      RENTAL.md                         # Rental details + analytics tables

public/
  icons/                                # PWA icons
  manifest.json                         # PWA manifest
  sw.js                                 # Service worker
```

## Design System
- **Theme**: Light, warm off-white (#FAF8F4 background, #1A1814 foreground)
- **Fonts**: Gloock (display/headings), Hanken Grotesk (body/UI), Fira Mono (numbers/data)
- **Accent**: GEA Gold #C8A96E — used sparingly; accent bars, badges, primary CTA
- **Cards**: `rounded` (not `rounded-full`), `border-border`, hover lift via `hover:-translate-y-1 hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]`
- **Animations**: `animate-fade-up` and `animate-accent-expand` defined in globals.css under `@media (prefers-reduced-motion: no-preference)`
- **Design context**: `.impeccable.md` — read by impeccable design skill for context

## Running Locally
```bash
npm run dev    # starts on localhost:3000 (or next available port)
npm run build  # production build
```

## Key Flows

### Agent creates a weekly report (sales)
1. Go to `/generate` — 7-step ReportWizard
2. Step 1: select property or enter details
3. Steps 2-3: enter REA/Domain stats OR upload CSV/PDF export
   - CSV/TSV: parsed client-side via `parseCSVStats()` in ReportWizard.tsx
   - PDF: extracted server-side via `/api/extract-pdf`, then AI-parsed via `/api/parse-stats`
4. Step 4: inspections
5. Step 5: agent commentary (can AI-draft via `/api/draft-commentary`)
6. Step 6: market news (can AI-draft via `/api/draft-market-news`)
7. Step 7: generate full narrative via `/api/generate-report` (MiniMax)
8. Report saved to draft; agent can approve — vendor views at `/vendor/[token]`

### Agent creates a rental report
1. Go to `/generate/rental` — 6-step RentalReportWizard
2. Steps cover: property select, portal stats, applications, inspections, commentary, narrative
3. AI narrative via `/api/generate-report/rental` (MiniMax, rental-focused prompt)

### Vendor / landlord views their report
- Sales: `/vendor/[token]` — resolves via `vendor-tokens.json`
- Rental: `/landlord/[token]` — resolves via `rental-tokens.json`
- Shows approved draft: stats, checklist, comms log, inspection history, market news

### Monday workflow (agent)
1. Click **Generate This Week's Drafts** — creates a draft per property, pre-filled from the GEA CRM read API (property + portal stats + inspections), with gaps flagged where the CRM has no data
2. Complete/override reports for each property (agent edits win over CRM refresh), approve, share vendor links
3. Optionally **refresh** a draft to re-pull the latest CRM data without losing agent edits (`/api/weekly-drafts/[id]/refresh`)

## Current Status (as of 15 May 2026)
### Done
- Agent dashboard with portal performance stats + activity breakdown
- Sales report wizard (7 steps) with CSV/PDF import and AI narrative generation
- Rental report wizard (6 steps) with AI narrative
- Vendor portal (`/vendor/[token]`) — token-gated, shows stats, checklist, comms, inspections
- Landlord portal (`/landlord/[token]`) — parallel namespace for rental listings
- Markdown data layer for properties and rentals
- Weekly draft workflow (create, edit, approve)
- CRM-backed draft data: drafts pre-fill from the GEA_crmAI read API (gap-aware, per-field provenance, agent edits win); direct VaultRE integration retired
- PWA support (manifest, service worker, icons)
- Full design polish pass: Gloock/Hanken Grotesk/Fira Mono type system, warm GEA palette, animated hero stat cards, reduced-motion accessible animations
- Deterministic impeccable scan: clean (zero pattern flags)
- Rental cards on dashboard (RentalCard component)
- Animated count-up on hero stat cards (AnimatedNumber, reduced-motion aware)

### Done (UX cleanup pass — P1–P5, completed 22 Jun 2026)
- **[P1] PropertyCard navigation trap** — card is now a plain `<div>`; footer has a "View Report →" link and a one-click `ApproveDraftButton`. No nested-interactive HTML.
- **[P2] GenerateDraftsButton errors** — error state surfaced inline; button label shows "Generate Drafts · week ending {date}".
- **[P3] Sync → Generate cue** — resolved; `WeeklyWorkflow` is a single Generate action (drafts pull from CRM at generate time).
- **[P4] RentalCard false affordance** — hover lift removed; real "New report" / "View portal →" links in footer.
- **[P5] Aggregate stat cards** — collapsed to a single-line metric strip under the h1 (`{date} · n listings · n views · n enquiries · n pending`) at `src/app/page.tsx`.

### TODO (next session) — ordered by impact
1. **PDF export** — generate downloadable vendor reports for email
2. **CRM Track 2 consumer** — confirm/complete the weekly-report CRM read-API wiring (memory flags as not-fully-wired; recent commits underway)
3. **Chat backend** — persist agent-vendor messages (Chat.tsx is UI only, no storage)
4. **Week-over-week trends** — show % change vs previous week on stat cards
5. **Historical data** — let vendors/agents browse past weeks' reports
6. **Deploy** — host publicly so vendors can access their portal

## Dev Notes
- Port 3000 may be in use; dev server will auto-pick next available port
- The iCloud path has spaces — always quote paths in terminal commands
- Brand colours: primary navy `#1e3a5f`, accent gold `#c9a96e` (internal tool uses warm variant: `--accent: #C8A96E`)
- `MINIMAX_API_KEY` must be set in `.env.local` — used by all AI routes
- `CRM_API_BASE_URL` and `WEEKLY_REPORT_API_TOKEN` must be set in `.env.local` for CRM-backed draft data (the CRM owns the VaultRE/portal integrations; this app no longer calls VaultRE directly). Until set, drafts generate with gap-flagged fields.
- CSV uploads are parsed entirely client-side (no API call) — see `parseCSVStats()` in `ReportWizard.tsx`
- PDF uploads: `/api/extract-pdf` (pdf-parse) then `/api/parse-stats` (MiniMax AI)
- Vendor tokens: `src/lib/vendor-tokens.json` | Rental tokens: `src/lib/rental-tokens.json` (both gitignored in prod)
- Do NOT deploy to Vercel — use an alternative host
- `.impeccable.md` at project root stores design context for the impeccable design skill
- **Git state**: clean — local `main` and `origin/main` are in sync at `b406b55` (the earlier Apple HIG divergence was resolved via force-push).
