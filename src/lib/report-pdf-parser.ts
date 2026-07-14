/**
 * Parses text extracted from a weekly REA (realestate.com.au) or Domain
 * property-report PDF into the fields writeAnalyticsFile expects.
 *
 * ASSUMPTION (unverified against a real report — no sample PDF was available
 * when this was written): both reports render as a label followed by a
 * number, one per line or separated by whitespace, using the labels below.
 * If real reports use a different layout, the regexes will need updating —
 * that is why extraction failures return a 422 with the specific missing
 * field rather than guessing, and why report-pdf-parser.test.ts is the first
 * place to fix if real PDFs don't match.
 *
 * ponytail: text-in/data-out only. PDF byte handling and pdf-parse's dynamic
 * import stay in the route (src/app/api/ingest/report-pdf/route.ts) so this
 * module is testable on plain strings.
 */

export type ReportSource = 'rea' | 'domain';

export interface ParsedReport {
  source: ReportSource;
  weekEnding: string; // YYYY-MM-DD
  views: number;
  enquiries: number;
  saves: number;
  searchAppearances: number;
  address?: string;
}

export interface ParseFailure {
  missing: string[];
  detectedSource: ReportSource | null;
}

const REA_MARKERS = ['realestate.com.au', 'REA Group'];
const DOMAIN_MARKERS = ['domain.com.au', 'Domain Group'];

function detectSource(text: string): ReportSource | null {
  const lower = text.toLowerCase();
  if (REA_MARKERS.some(m => lower.includes(m.toLowerCase()))) return 'rea';
  if (DOMAIN_MARKERS.some(m => lower.includes(m.toLowerCase()))) return 'domain';
  return null;
}

// Matches "Views: 1,234" / "Views 1234" / "Total views  1,234" (case-insensitive,
// tolerant of thousands separators and a colon that may or may not be present).
function extractNumber(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*:?\\s*([\\d,]+)`, 'i');
    const match = text.match(re);
    if (match) {
      const n = parseInt(match[1].replace(/,/g, ''), 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

// Matches "Week ending 12 Jan 2026" / "Week Ending: 2026-01-12" / "For the week ending 12/01/2026"
function extractWeekEnding(text: string): string | null {
  const iso = text.match(/week\s*ending\s*:?\s*(\d{4}-\d{2}-\d{2})/i);
  if (iso) return iso[1];

  const dmy = text.match(/week\s*ending\s*:?\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (dmy) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const mm = months[dmy[2].slice(0, 3).toLowerCase()];
    if (mm) return `${dmy[3]}-${mm}-${dmy[1].padStart(2, '0')}`;
  }

  const slash = text.match(/week\s*ending\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  }

  return null;
}

function extractAddress(text: string): string | undefined {
  // ASSUMPTION: the subject address appears on its own line near the top,
  // immediately before or after a "Property Report" / "Listing Report" title.
  const match = text.match(/^(.*(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Boulevard|Blvd|Place|Pl|Way|Crescent|Cres)[^\n]*)/im);
  return match ? match[1].trim() : undefined;
}

/**
 * Parse extracted PDF text into a ParsedReport. Returns a ParseFailure
 * (never a partial/guessed result) if the source can't be detected or any
 * required numeric field is missing.
 */
export function parseReportText(text: string): ParsedReport | ParseFailure {
  const detectedSource = detectSource(text);
  const missing: string[] = [];

  if (!detectedSource) missing.push('source (no REA or Domain marker found)');

  const weekEnding = extractWeekEnding(text);
  if (!weekEnding) missing.push('weekEnding');

  const views = extractNumber(text, ['Views', 'Total views', 'Listing views', 'Property views']);
  if (views == null) missing.push('views');

  const enquiries = extractNumber(text, ['Enquiries', 'Email enquiries', 'Total enquiries']);
  if (enquiries == null) missing.push('enquiries');

  const saves = extractNumber(text, ['Saves', 'Shortlists', 'Favourites', 'Saved']);
  if (saves == null) missing.push('saves');

  const searchAppearances = extractNumber(text, ['Search appearances', 'Search results appearances']) ?? 0;

  if (missing.length > 0) {
    return { missing, detectedSource };
  }

  return {
    source: detectedSource as ReportSource,
    weekEnding: weekEnding as string,
    views: views as number,
    enquiries: enquiries as number,
    saves: saves as number,
    searchAppearances,
    address: extractAddress(text),
  };
}

export function isParseFailure(result: ParsedReport | ParseFailure): result is ParseFailure {
  return 'missing' in result;
}
