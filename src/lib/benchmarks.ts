/**
 * Benchmark fetching via everypropertyai MCP.
 * Benchmarks are captured at draft-generation time and stored in property markdown
 * with a capture date, so the portal render stays filesystem-only and fast.
 */

export interface Benchmark {
  /** Metric name (e.g. 'Views', 'Enquiries') */
  metric: string;
  /** This listing's value */
  listingValue: number;
  /** Suburb median for this metric */
  suburbMedian: number | null;
  /** Price-bracket median for this metric */
  bracketMedian: number | null;
  /** ISO timestamp when benchmark was captured */
  capturedAt: string;
  /** Data source (e.g. 'everypropertyai') */
  source: string;
}

/**
 * Fetch benchmarks for a property from the everypropertyai MCP.
 * Returns a typed result; never throws. A failure returns an empty array.
 * Server-only. Called at draft-generation time and written to markdown.
 */
export async function fetchBenchmarks(
  address: string,
  suburb: string,
  priceGuide: string | null
): Promise<Benchmark[]> {
  // ponytail: never-throw client pattern matching crm-client.ts.
  // If MCP is unconfigured or unreachable, return [].
  try {
    const now = new Date().toISOString();

    // For now, this is a placeholder. The real implementation will call
    // the everypropertyai MCP (vendor_report, on_market_listings, comparable_sales).
    // U3 integration with MCP is pending MCP availability confirmation.
    // Field names and groupings should be reconciled against a real Ignite export in U2.

    // Placeholder: return empty array (no MCP yet)
    return [];
  } catch {
    // MCP failure, network error, or MCP unconfigured — degrade gracefully
    return [];
  }
}

/**
 * Format benchmarks for markdown storage.
 * Returns a markdown table as a multi-line string.
 */
export function formatBenchmarksTable(benchmarks: Benchmark[]): string {
  if (benchmarks.length === 0) {
    return '';
  }

  const header = '| Metric | Your Listing | Suburb Median | Price Bracket | Captured At | Source |';
  const separator = '|--------|-------------|---------------|--------------|------------|--------|';
  const rows = benchmarks.map(b => {
    const suburbStr = b.suburbMedian !== null ? String(b.suburbMedian) : '—';
    const bracketStr = b.bracketMedian !== null ? String(b.bracketMedian) : '—';
    const date = b.capturedAt.split('T')[0]; // YYYY-MM-DD
    return `| ${b.metric} | ${b.listingValue} | ${suburbStr} | ${bracketStr} | ${date} | ${b.source} |`;
  });

  return [header, separator, ...rows].join('\n');
}

/**
 * Parse benchmarks from a markdown table.
 * Returns an empty array if no table is found or parsing fails.
 */
export function parseBenchmarksTable(content: string): Benchmark[] {
  const benchmarks: Benchmark[] = [];

  // Find the Benchmarks section
  const benchmarkMatch = content.match(/## Benchmarks\n([\s\S]*?)(?:\n## |$)/);
  if (!benchmarkMatch) {
    return [];
  }

  const section = benchmarkMatch[1];
  const lines = section.split('\n');

  // Find header and separator
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Metric')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1 || headerIdx + 1 >= lines.length) {
    return [];
  }

  // Parse rows (skip header and separator)
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 6) continue;

    const listingVal = parseInt(cells[1], 10);
    const suburbVal = cells[2] === '—' ? null : parseInt(cells[2], 10);
    const bracketVal = cells[3] === '—' ? null : parseInt(cells[3], 10);

    if (isNaN(listingVal)) continue;

    benchmarks.push({
      metric: cells[0],
      listingValue: listingVal,
      suburbMedian: isNaN(suburbVal as number) ? null : (suburbVal as number),
      bracketMedian: isNaN(bracketVal as number) ? null : (bracketVal as number),
      capturedAt: cells[4] + 'T00:00:00Z', // Date only in markdown; assume UTC
      source: cells[5],
    });
  }

  return benchmarks;
}
