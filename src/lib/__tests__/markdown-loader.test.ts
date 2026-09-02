import { describe, it, expect } from 'vitest';
import { parseAnalyticsTable } from '../markdown-loader';

describe('parseAnalyticsTable', () => {
  it('parses a legacy six-column table, returning undefined for new fields', () => {
    const content = `
## Analytics Summary
| Week Ending | REA Views | REA Enquiries | REA Saves | Domain Views | Domain Enquiries | Domain Saves |
|-------------|-----------|---------------|-----------|--------------|------------------|--------------|
| 2026-08-24 | 100 | 5 | 8 | 120 | 6 | 10 |
`;
    const rows = parseAnalyticsTable(content);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      weekEnding: '2026-08-24',
      reaViews: 100,
      reaEnquiries: 5,
      reaSaves: 8,
      domainViews: 120,
      domainEnquiries: 6,
      domainSaves: 10,
      reaImpressions: undefined,
      domainImpressions: undefined,
      reaDetailViews: undefined,
      domainDetailViews: undefined,
      competingListings: undefined,
      reaSpend: undefined,
      domainSpend: undefined,
    });
  });

  it('parses a widened table with extended metrics', () => {
    const content = `
## Analytics Summary
| Week Ending | REA Views | REA Enquiries | REA Saves | Domain Views | Domain Enquiries | Domain Saves | REA Impressions | Domain Impressions | REA Detail Views | Domain Detail Views | Competing Listings | REA Spend | Domain Spend |
|-------------|-----------|---------------|-----------|--------------|------------------|--------------|-----------------|--------------------|-----------------|--------------------|--------------------|-----------|----|
| 2026-08-24 | 100 | 5 | 8 | 120 | 6 | 10 | 500 | 600 | 50 | 60 | 3 | 250 | 300 |
`;
    const rows = parseAnalyticsTable(content);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      weekEnding: '2026-08-24',
      reaViews: 100,
      reaEnquiries: 5,
      reaSaves: 8,
      domainViews: 120,
      domainEnquiries: 6,
      domainSaves: 10,
      reaImpressions: 500,
      domainImpressions: 600,
      reaDetailViews: 50,
      domainDetailViews: 60,
      competingListings: 3,
      reaSpend: 250,
      domainSpend: 300,
    });
  });

  it('treats a literal 0 in an extended column as 0, not undefined', () => {
    const content = `
## Analytics Summary
| Week Ending | REA Views | REA Enquiries | REA Saves | Domain Views | Domain Enquiries | Domain Saves | REA Impressions | Domain Impressions | REA Detail Views | Domain Detail Views | Competing Listings | REA Spend | Domain Spend |
|-------------|-----------|---------------|-----------|--------------|------------------|--------------|-----------------|--------------------|-----------------|--------------------|--------------------|-----------|----|
| 2026-08-24 | 100 | 5 | 8 | 120 | 6 | 10 | 0 | 600 | 0 | 60 | 0 | 250 | 300 |
`;
    const rows = parseAnalyticsTable(content);
    expect(rows).toHaveLength(1);
    expect(rows[0].reaImpressions).toBe(0);
    expect(rows[0].reaDetailViews).toBe(0);
    expect(rows[0].competingListings).toBe(0);
  });

  it('treats empty cells in extended columns as undefined', () => {
    const content = `
## Analytics Summary
| Week Ending | REA Views | REA Enquiries | REA Saves | Domain Views | Domain Enquiries | Domain Saves | REA Impressions | Domain Impressions | REA Detail Views | Domain Detail Views | Competing Listings | REA Spend | Domain Spend |
|-------------|-----------|---------------|-----------|--------------|------------------|--------------|-----------------|--------------------|-----------------|--------------------|--------------------|-----------|----|
| 2026-08-24 | 100 | 5 | 8 | 120 | 6 | 10 |  |  |  |  |  |  |  |
`;
    const rows = parseAnalyticsTable(content);
    expect(rows).toHaveLength(1);
    expect(rows[0].reaImpressions).toBeUndefined();
    expect(rows[0].domainSpend).toBeUndefined();
  });

  it('handles mixed legacy and extended rows in the same table', () => {
    const content = `
## Analytics Summary
| Week Ending | REA Views | REA Enquiries | REA Saves | Domain Views | Domain Enquiries | Domain Saves | REA Impressions | Domain Impressions | REA Detail Views | Domain Detail Views | Competing Listings | REA Spend | Domain Spend |
|-------------|-----------|---------------|-----------|--------------|------------------|--------------|-----------------|--------------------|-----------------|--------------------|--------------------|-----------|----|
| 2026-08-17 | 50 | 2 | 4 | 60 | 3 | 5 |  |  |  |  |  |  |  |
| 2026-08-24 | 100 | 5 | 8 | 120 | 6 | 10 | 500 | 600 | 50 | 60 | 3 | 250 | 300 |
`;
    const rows = parseAnalyticsTable(content);
    expect(rows).toHaveLength(2);
    expect(rows[0].reaImpressions).toBeUndefined();
    expect(rows[1].reaImpressions).toBe(500);
  });

});
