---
title: "feat: Broadcast article links to all vendor reports via Telegram"
date: 2026-07-21
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
plan_type: feat
---

# feat: Broadcast article links to all vendor reports via Telegram

## Summary

An agent pastes a market-news article link (with a title/summary, as Telegram auto-previews) into the GEA Telegram bot chat, prefixed with a trigger phrase like "Add this article link and summary to all property reports this week". The system parses the URL, fetches the article's title/description, and appends it as a `NewsArticle` to every sales property's current-week `WeeklyDraft`, so it shows up in the existing "Market News" section on every vendor portal at once — instead of an agent manually drafting market news per property.

## Problem Frame

`NewsArticle[]` and the `MarketNews` component already exist end-to-end for a *single* property (AI-drafted via `/api/draft-market-news`, stored per-draft in `WeeklyDraft.newsArticles`, rendered by `src/components/vendor/MarketNews.tsx`). There is no way today to push one article to *every* property's report at once — an agent would have to open each of N drafts and add it manually. The Telegram ingest route (`src/app/api/ingest/telegram/route.ts`) already handles free-form notes and inspection shorthand from the same chat; this adds a third message shape it recognizes: an article broadcast.

## Scope Boundaries

**In scope:** Sales listings only (`WeeklyDraft` JSON under `GEA_vendor_portal/properties/{slug}/weekly/`). Telegram ingest only. Explicit trigger phrase + URL detection (not "any message with a link").

### Deferred to Follow-Up Work
- Rentals (`RENTAL.md`) have no `WeeklyDraft`-equivalent weekly JSON today — extending broadcast to landlords needs that storage built first.
- WhatsApp ingest (`src/app/api/ingest/whatsapp/route.ts`) shares `message-parsers.ts` with Telegram but is not wired to this feature in this plan; same parser can be reused later with minimal work since the parsing logic is channel-agnostic.
- Removing/editing a broadcast article after the fact (agents can already do this per-property via the existing draft PATCH endpoint / wizard).

## Requirements

- R1: An agent can send a Telegram message containing a trigger phrase, a URL, and a summary, and have it parsed into an article (title, url, note).
- R2: The parsed article is appended to `newsArticles` on every sales property's `WeeklyDraft` for the current report week (via `getReportWeekEnding()`), creating the week's draft first if it doesn't exist yet.
- R3: The bot reply confirms which/how many properties were updated, and reports properties it could not update.
- R4: Existing Telegram message shapes (free-form notes, inspection shorthand) continue to parse unchanged — the new shape must not shadow them.

## Key Technical Decisions

**KTD1 — Detect via trigger phrase, not bare URL.** A message must start with an explicit phrase (`add this article`, case-insensitive) and contain a URL to be treated as a broadcast. Rationale (per user decision): avoids misfiring when an agent pastes a link in an unrelated note. Implemented as a new parser function in `src/lib/message-parsers.ts`, checked *before* `parseFreeformNote`/`parseTelegramMessage` in the route so it can't be shadowed and can't shadow them (its match is far more specific).

**KTD2 — Title/summary source: prefer inline text, fall back to page fetch.** Telegram's outgoing webhook payload for a link message typically includes the sender's own text (which already contains a headline + summary, per the screenshot). Parse `title`/`note` from the message text after the URL when present. If the message has no text beyond the URL, fetch the URL server-side and extract `<title>` / `og:description` (same lightweight regex-based extraction style already used in `src/app/api/draft-market-news/route.ts`'s `stripTags`/`decodeEntities` helpers — reuse, don't reinvent).

**KTD3 — Broadcast writes go through `weekly-drafts.ts`, not raw file I/O.** Reuse `getAllProperties()` + `getWeeklyDraft`/`generateWeeklyDraftForProperty` + `saveWeeklyDraft` (already imported by `weekly-drafts.ts`) so broadcast drafts get the same shape (fieldSources, agentEdited, etc.) as normal drafts. A property with no draft yet for this week gets one generated on the fly (via `generateWeeklyDraftForProperty`) rather than being skipped, so a Monday-morning article broadcast before "Generate This Week's Drafts" still lands everywhere.

**KTD4 — Dedupe by URL per draft.** If the same article URL is broadcast twice (e.g. agent resends), skip re-adding it to a draft that already has that URL rather than creating a duplicate list entry.

## High-Level Technical Design

```
Telegram message
  "Add this article link and summary to all property reports this week
   https://... \n<title>\n<summary>"
       │
       ▼
parseArticleBroadcast(message)  [message-parsers.ts]
  → { url, title?, note? } | null
       │
       ▼ (only if matched — checked before existing parsers)
POST /api/ingest/telegram
       │
       ├─ if title/note missing → fetchArticleMeta(url)  [new helper]
       │
       ▼
broadcastArticleToAllDrafts(article, weekEnding)  [weekly-drafts.ts]
       │
       ├─ getAllProperties()
       ├─ for each: getWeeklyDraft(slug, week) ?? generateWeeklyDraftForProperty(slug, week)
       ├─ skip if newsArticles already has this url
       ├─ push { id, title, url, note } to newsArticles
       └─ saveWeeklyDraft(updated)
       │
       ▼
{ success, updatedCount, skippedCount, properties: [...] }  → Telegram reply text
```

## Implementation Units

### U1. Article-broadcast message parser

**Goal:** Recognize the trigger-phrase + URL Telegram message shape and extract `{ url, title, note }`, without disturbing the existing note/inspection parsers.

**Requirements:** R1, R4

**Dependencies:** none

**Files:**
- `src/lib/message-parsers.ts` — add `parseArticleBroadcast(message: string): { url: string; title?: string; note?: string } | null`
- `src/lib/message-parsers.test.ts` (new, mirrors existing parser test conventions if a test file already exists for this module — check first; if none exists, create alongside)

**Approach:** Match a case-insensitive leading trigger (`/^\s*add this article/i`) anywhere the message also contains a URL (`/(https?:\/\/\S+)/`). Everything after the URL, split by newline, becomes candidate title (first non-empty line) / note (remaining non-empty lines joined). If the URL is the only content besides the trigger phrase, return `{ url, title: undefined, note: undefined }` so the caller knows to fetch metadata.

**Patterns to follow:** `parseFreeformNote` / `parseTelegramMessage` in the same file — same signature style (parse-or-null), same regex-first approach.

**Test scenarios:**
- Happy path: `"Add this article link and summary to all property reports this week\nhttps://www.abc.net.au/news/...\nThree graphs that show uncertainty\nGlobal instability... force buyers to adjust."` → returns correct `{url, title, note}`.
- Case-insensitivity: `"add THIS article ... https://..."` still matches.
- URL-only (no title/note text) → returns `{url, title: undefined, note: undefined}`.
- Non-matching message with a URL but no trigger phrase (e.g. a normal note that happens to include a link) → returns `null`, so it falls through to `parseFreeformNote`.
- Trigger phrase present but no URL at all → returns `null` (nothing to broadcast).
- Multiple URLs in the message → first URL wins (documents the behavior; avoids ambiguity).

**Verification:** Unit tests above pass; existing `parseFreeformNote`/`parseTelegramMessage` tests (if present) remain green, confirming no shadowing.

---

### U2. Article metadata fallback fetch

**Goal:** When the Telegram message carries only a bare URL (no inline title/summary), fetch the page and extract a title + description server-side.

**Requirements:** R1

**Dependencies:** U1

**Files:**
- `src/lib/article-meta.ts` (new) — `fetchArticleMeta(url: string): Promise<{ title: string; note: string } | null>`

**Approach:** `fetch(url)` with a short timeout, extract `<title>` and `og:description`/`<meta name="description">` via the same regex/`stripTags`/`decodeEntities` style already used in `src/app/api/draft-market-news/route.ts`. On fetch failure or missing title, return `null` — caller treats this as "could not determine title, ask agent to resend with text."

**Patterns to follow:** `src/app/api/draft-market-news/route.ts`'s `decodeEntities`/`stripCData`/`stripTags` helpers — extract to a small shared util only if duplicating them verbatim would exceed ~15 lines; otherwise a lazy inline copy is fine (this is a 2-line extraction, not worth a shared module per the project's existing style of small per-route parsing helpers).

**Test scenarios:**
- Happy path: URL resolves, HTML has `<title>` and `og:description` → returns both.
- Page has `<title>` but no description meta → returns `{ title, note: '' }` (caller may still proceed with an empty summary rather than failing the whole broadcast).
- Fetch throws (network error, non-200) → returns `null`.
- Test expectation: none beyond the above — no edge cases around malformed HTML need dedicated coverage since `stripTags`/`decodeEntities` are already covered by the market-news route's existing behavior.

**Verification:** Unit test with a mocked `fetch` covering the three scenarios above.

---

### U3. Broadcast-to-all-drafts write path

**Goal:** Given a parsed article and a week-ending date, add it to every sales property's `WeeklyDraft.newsArticles`, creating drafts as needed, deduping by URL.

**Requirements:** R2, R4

**Dependencies:** U1

**Files:**
- `src/lib/weekly-drafts.ts` — add `broadcastArticleToAllDrafts(article: { title: string; url: string; note: string }, weekEnding: string): Promise<{ updated: string[]; skipped: string[] }>`

**Approach:** `getAllProperties()` → for each slug: `getWeeklyDraft(slug, weekEnding)`, falling back to `generateWeeklyDraftForProperty(slug, weekEnding)` if `null`. If `draft.newsArticles.some(a => a.url === article.url)`, add slug to `skipped` and continue. Otherwise push `{ id: crypto.randomUUID(), ...article }` into `newsArticles`, `saveWeeklyDraft(updated)`, add slug to `updated`. Run sequentially or with bounded concurrency — property count is small (matches existing `Promise.all` pattern in `getAllWeeklyDrafts`, safe to reuse `Promise.all` here too since each write targets a distinct file).

**Patterns to follow:** `generateAllWeeklyDrafts` in the same file for the "map over all properties, generate-if-missing" shape.

**Test scenarios:**
- Happy path: 3 properties, none have a draft yet → all 3 get a new draft generated and the article appended; returns `updated: [all 3 slugs]`.
- Mixed: some properties already have a draft (existing `newsArticles: []`) and some don't → both paths produce the article being added.
- Dedup: a property's draft already has an article with the same `url` → that slug appears in `skipped`, `newsArticles` unchanged (not duplicated).
- One property's `generateWeeklyDraftForProperty` throws (e.g. malformed property markdown) → that slug is recorded as failed/skipped and the broadcast continues for the remaining properties rather than aborting entirely.
- Integration: verify `saveWeeklyDraft` is actually called with the mutated draft (not just constructed in memory) for each updated slug — this is the behavior mocks alone won't prove since it crosses the file-write boundary.

**Verification:** Unit tests against a temp `PROPERTIES_DIR` fixture (mirrors how existing `weekly-drafts.ts` tests, if any, set up fixtures) confirming the on-disk JSON reflects the appended article.

---

### U4. Wire broadcast parsing into the Telegram ingest route

**Goal:** Recognize the broadcast shape first in `POST /api/ingest/telegram`, resolve metadata if needed, call the broadcast write path, and return a useful confirmation.

**Requirements:** R1, R2, R3, R4

**Dependencies:** U1, U2, U3

**Files:**
- `src/app/api/ingest/telegram/route.ts` — add the broadcast branch ahead of the existing `parseFreeformNote` check
- `src/app/api/ingest/telegram/route.test.ts` (new, or extend existing route test file if present)

**Approach:** After `ingestGuard`, try `parseArticleBroadcast(message)` first (most specific match). If matched: if `title`/`note` are missing, call `fetchArticleMeta(url)`; if that also fails, return a 422-style JSON error asking the agent to resend with a title/summary line. Otherwise call `getReportWeekEnding()` (already exported from `weekly-drafts.ts`) then `broadcastArticleToAllDrafts(...)`, and return `{ success: true, kind: 'article-broadcast', article, weekEnding, updated, skipped }`. Only if `parseArticleBroadcast` returns `null` does execution fall through to the existing `parseFreeformNote` → `parseTelegramMessage` chain, unchanged.

**Patterns to follow:** Existing branch structure in the same route (`note` path, then `parsed` inspection path) — this is a third branch in the same `try` block, same response shape conventions (`success`, `kind`, relevant IDs).

**Test scenarios:**
- Happy path (Covers R1-R3): full trigger message with inline title/summary → 200, `kind: 'article-broadcast'`, `updated` lists all property slugs.
- Bare-URL message: metadata fetch succeeds → same happy-path result, sourced from `fetchArticleMeta`.
- Bare-URL message, metadata fetch fails → 422/400 with a clear error telling the agent to include a title/summary.
- Non-broadcast messages (existing free-form note text, existing inspection shorthand) still route to their original branches unchanged — regression check for R4.
- `ingestGuard` denial (missing/invalid auth) still short-circuits before any parsing, exactly as today.
- Partial failure: `broadcastArticleToAllDrafts` reports some `skipped` (dedup or generation failure) → response surfaces both `updated` and `skipped` so the agent's Telegram reply can say "Added to 8 properties, skipped 1 (already had this article)."

**Verification:** Route-level test hitting the handler with each message shape above, asserting response shape and that `broadcastArticleToAllDrafts` was called with the right args only on the broadcast path.

---

### U5. Surface broadcast articles on the vendor portal (verify, likely no-op)

**Goal:** Confirm the existing `MarketNews` rendering path already picks up `WeeklyDraft.newsArticles` end-to-end for broadcast-added articles — no new UI code expected, but the wiring between `WeeklyDraft.newsArticles` and what `src/app/vendor/[token]/page.tsx` actually reads must be verified, since `MarketNews` is currently driven by data from `markdown-loader.ts`/`data-adapter.ts`, and it's not yet confirmed that approving/reading a `WeeklyDraft` surfaces `newsArticles` through to the same `VendorReport.newsArticles` the portal renders.

**Requirements:** R2, R3

**Dependencies:** U3

**Files:**
- `src/lib/data-adapter.ts` — read (and patch only if the gap below is real)
- `src/app/vendor/[token]/page.tsx` — read (and patch only if needed)

**Approach:** Trace how an approved `WeeklyDraft.newsArticles` currently reaches `VendorReport.newsArticles` for the *existing* single-property AI-drafted-news case. If that path already exists and works, this unit is verification-only — no code change. If it turns out `newsArticles` on the draft is not actually propagated to the rendered portal today (a pre-existing gap unrelated to this feature), fix the adapter to pass it through, since otherwise the whole broadcast feature would write data nobody ever sees.

**Patterns to follow:** Whatever mapping `data-adapter.ts` already does for other `WeeklyDraft` fields (e.g. `agentCommentary`) that do reach the portal.

**Test scenarios:**
- Test expectation: none if verification confirms the path already works — record the finding in the PR description instead of adding redundant tests for existing behavior.
- If a gap is found and fixed: one test asserting `propertyToVendorReport`/equivalent adapter includes `newsArticles` from an approved draft.

**Verification:** Manually trace `newsArticles` from `WeeklyDraft` → adapter → `VendorReport` → `MarketNews` props; confirm with a quick local run (`npm run dev`, approve a draft with a broadcast article, load `/vendor/[token]`) that the article renders.

## Verification Contract

- All new/changed unit tests (U1-U4) pass.
- Manual end-to-end check: POST a broadcast-shaped payload to `/api/ingest/telegram` locally (with `AGENT_API_KEY` set) against the real `PROPERTIES_DIR`, confirm every property's `weekly/{weekEnding}.json` gains the article, and confirm it renders on at least one `/vendor/[token]` portal (closes U5).
- Sending the same broadcast twice does not duplicate the article (KTD4).
- Existing Telegram note/inspection ingestion still behaves identically (run/verify existing test coverage for `message-parsers.ts` and the telegram route, if present).

## Definition of Done

- U1-U4 implemented and tested.
- U5's verification completed (with a fix landed if the gap is real).
- An agent can paste an article link in Telegram with the trigger phrase and see it appear on every current-week vendor portal without touching each property's draft individually.
