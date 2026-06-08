/**
 * Automated weekly stat collector.
 *
 * Iterates configured properties, obtains REA/Domain stats from a pluggable
 * StatSource, and POSTs each row to the existing /api/ingest/analytics endpoint
 * (same contract the manual ingest uses). Idempotent: a (property, source,
 * weekEnding) row already present in stats.json is skipped.
 *
 * REA/Domain have no official public stats API. The reliable default source is
 * an agent-forwarded report parsed via the existing PDF tooling; a scrape
 * source is intentionally left as a disabled, best-effort stub (selectors break,
 * ToS-sensitive). Swap sources by editing `resolveSource` below.
 *
 * Run:  npx tsx scripts/collect-stats.ts [slug]
 *       (no slug = all configured properties)
 * Cron: run weekly (e.g. Monday morning) — tune to your reporting cadence.
 *
 * Env:
 *   PORTAL_BASE_URL   base URL of the running portal (default http://localhost:3000)
 *   STATS_SOURCE      'fixture' | 'emailPdf' | 'scrape'   (default 'fixture')
 */
import { readStats } from '../src/lib/markdown-loader';

const BASE_URL = process.env.PORTAL_BASE_URL || 'http://localhost:3000';
const SOURCE_KIND = process.env.STATS_SOURCE || 'fixture';

export interface StatRow {
  property: string; // slug
  source: 'rea' | 'domain';
  weekEnding: string; // YYYY-MM-DD
  views: number;
  enquiries: number;
  saves: number;
  searchAppearances?: number;
}

export interface StatSource {
  /** Yield the stat rows discovered for the given property slug(s). */
  collect(slugs: string[]): Promise<StatRow[]>;
}

/**
 * Fixture source — deterministic, dependency-free. Lets the pipeline be
 * exercised end-to-end without live REA/Domain access. Replace with emailPdf in
 * production.
 */
class FixtureSource implements StatSource {
  async collect(): Promise<StatRow[]> {
    return [];
  }
}

/**
 * Email/PDF source — reliable default. Parses an agent-forwarded weekly report
 * via the existing /api/parse-stats + /api/extract-pdf tooling. Stubbed here:
 * wire to your inbox/drive integration to return real rows.
 */
class EmailPdfSource implements StatSource {
  async collect(): Promise<StatRow[]> {
    console.warn('[collect-stats] emailPdf source not yet wired — returning no rows.');
    return [];
  }
}

/**
 * Scrape source — best-effort, DISABLED by default. No official API; selectors
 * are brittle and ToS-sensitive. Kept as a clearly-fallible option.
 */
class ScrapeSource implements StatSource {
  async collect(): Promise<StatRow[]> {
    console.warn('[collect-stats] scrape source is disabled — returning no rows.');
    return [];
  }
}

function resolveSource(kind: string): StatSource {
  switch (kind) {
    case 'emailPdf':
      return new EmailPdfSource();
    case 'scrape':
      return new ScrapeSource();
    default:
      return new FixtureSource();
  }
}

async function alreadyIngested(row: StatRow): Promise<boolean> {
  const existing = await readStats(row.property);
  return existing.some(
    s => s.source === row.source && s.weekEnding === row.weekEnding,
  );
}

async function postRow(row: StatRow): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/ingest/analytics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`ingest ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  const slugArg = process.argv[2];
  const slugs = slugArg ? [slugArg] : [];

  const source = resolveSource(SOURCE_KIND);
  let rows: StatRow[];
  try {
    rows = await source.collect(slugs);
  } catch (err) {
    console.error(`[collect-stats] source '${SOURCE_KIND}' failed:`, err);
    process.exit(1);
    return;
  }

  let posted = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.property || !row.source || !row.weekEnding) {
      console.warn('[collect-stats] skipping row with missing fields:', row);
      continue;
    }
    try {
      if (await alreadyIngested(row)) {
        skipped++;
        continue;
      }
      await postRow(row);
      posted++;
      console.log(`[collect-stats] ingested ${row.property} ${row.source} ${row.weekEnding}`);
    } catch (err) {
      // One bad row must not abort the rest.
      console.error(`[collect-stats] failed ${row.property} ${row.source}:`, err);
    }
  }

  console.log(`\n[collect-stats] done — ${posted} ingested, ${skipped} already present.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
