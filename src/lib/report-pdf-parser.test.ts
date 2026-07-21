import { describe, it, expect } from 'vitest';
import { parseReportText, isParseFailure } from './report-pdf-parser';

// Fixture text stands in for pdf-parse's extracted text. No real REA/Domain
// PDF was available to derive these from — see the ASSUMPTION note in
// report-pdf-parser.ts. If real reports render differently, these fixtures
// and the extraction regexes both need updating.
const REA_FIXTURE = `
85 Centenary Boulevard, Officer South VIC 3809
realestate.com.au — Weekly Property Report
Week ending 12 January 2026

Views: 1,204
Enquiries: 8
Saves: 23
Search appearances: 340
`;

const DOMAIN_FIXTURE = `
85 Centenary Boulevard, Officer South VIC 3809
domain.com.au Property Performance Report
Week Ending: 2026-01-12

Total views  980
Total enquiries  5
Shortlists  17
`;

describe('parseReportText', () => {
  it('extracts all fields from a REA-style report', () => {
    const result = parseReportText(REA_FIXTURE);
    expect(isParseFailure(result)).toBe(false);
    if (!isParseFailure(result)) {
      expect(result.source).toBe('rea');
      expect(result.weekEnding).toBe('2026-01-12');
      expect(result.views).toBe(1204);
      expect(result.enquiries).toBe(8);
      expect(result.saves).toBe(23);
      expect(result.searchAppearances).toBe(340);
      expect(result.address).toContain('85 Centenary Boulevard');
    }
  });

  it('extracts all fields from a Domain-style report', () => {
    const result = parseReportText(DOMAIN_FIXTURE);
    expect(isParseFailure(result)).toBe(false);
    if (!isParseFailure(result)) {
      expect(result.source).toBe('domain');
      expect(result.weekEnding).toBe('2026-01-12');
      expect(result.views).toBe(980);
      expect(result.enquiries).toBe(5);
      expect(result.saves).toBe(17);
      expect(result.searchAppearances).toBe(0);
    }
  });

  it('reports the specific missing field rather than guessing', () => {
    const noSaves = REA_FIXTURE.replace(/Saves: 23\n/, '');
    const result = parseReportText(noSaves);
    expect(isParseFailure(result)).toBe(true);
    if (isParseFailure(result)) {
      expect(result.missing).toContain('saves');
      expect(result.detectedSource).toBe('rea');
    }
  });

  it('reports an unrecognised source rather than guessing', () => {
    const result = parseReportText('Some unrelated PDF text with no markers.');
    expect(isParseFailure(result)).toBe(true);
    if (isParseFailure(result)) {
      expect(result.detectedSource).toBeNull();
      expect(result.missing.length).toBeGreaterThan(0);
    }
  });

  it('handles comma-formatted thousands', () => {
    const result = parseReportText(REA_FIXTURE.replace('1,204', '12,345'));
    expect(isParseFailure(result)).toBe(false);
    if (!isParseFailure(result)) expect(result.views).toBe(12345);
  });
});
