import { describe, it, expect } from 'vitest';
import {
  parseMarkdownTable,
  parseAnalyticsTable,
  parseInspectionsTable,
  parseCommunicationsTable,
  parseChecklist,
} from './markdown-loader';

describe('parseMarkdownTable', () => {
  const table = `
Some preamble.

| Week Ending | REA Views | Notes |
|-------------|-----------|-------|
| 2026-01-05  | 120       | good  |
| 2026-01-12  | 145       | up    |

Trailing prose after a blank line.
`;

  it('parses a pipe table into rows keyed by header', () => {
    const rows = parseMarkdownTable(table, 'Week Ending');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ 'Week Ending': '2026-01-05', 'REA Views': '120', Notes: 'good' });
    expect(rows[1]['REA Views']).toBe('145');
  });

  it('stops at the first non-table line', () => {
    const rows = parseMarkdownTable(table, 'Week Ending');
    // "Trailing prose" must not leak into the rows
    expect(rows.every(r => r['Week Ending'].startsWith('2026'))).toBe(true);
  });

  it('handles missing trailing cells without throwing', () => {
    const sparse = `
| Date | Type | Notes |
|------|------|-------|
| 2026-02-01 | Open |
`;
    const rows = parseMarkdownTable(sparse, 'Date');
    expect(rows).toHaveLength(1);
    expect(rows[0].Date).toBe('2026-02-01');
    expect(rows[0].Notes).toBe(''); // absent cell → empty string, not undefined
  });

  it('returns [] when the header is absent', () => {
    expect(parseMarkdownTable('no table here', 'Week Ending')).toEqual([]);
  });
});

describe('parseAnalyticsTable', () => {
  it('extracts numeric columns and filters empty weeks', () => {
    const md = `
| Week Ending | REA Views | REA Enquiries | REA Saves | Domain Views | Domain Enquiries | Domain Saves |
|---|---|---|---|---|---|---|
| 2026-01-05 | 120 | 4 | 9 | 80 | 2 | 5 |
`;
    const rows = parseAnalyticsTable(md);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ weekEnding: '2026-01-05', reaViews: 120, domainEnquiries: 2 });
  });

  it('degrades a malformed number to 0, never NaN', () => {
    const md = `
| Week Ending | REA Views |
|---|---|
| 2026-01-05 | n/a |
`;
    const rows = parseAnalyticsTable(md);
    expect(rows[0].reaViews).toBe(0);
    expect(Number.isNaN(rows[0].reaViews)).toBe(false);
  });
});

describe('parseInspectionsTable', () => {
  it('falls back from "Interest Level" to "Interest" header', () => {
    const withInterest = `
| Date | Type | Groups | Interest | Notes |
|---|---|---|---|---|
| 2026-01-10 | Open | 3 | High | busy |
`;
    const rows = parseInspectionsTable(withInterest);
    expect(rows[0]).toMatchObject({ date: '2026-01-10', groups: 3, interestLevel: 'High' });
  });
});

describe('parseCommunicationsTable', () => {
  it('reads only the table under ## Communications Log, not an inspection table', () => {
    const md = `
## Inspection History
| Date | Type | Groups |
|---|---|---|
| 2026-01-10 | Open | 3 |

## Communications Log
| Date | Type | Summary |
|---|---|---|
| 2026-01-11 | Call | Discussed price |
`;
    const rows = parseCommunicationsTable(md);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2026-01-11', type: 'Call', summary: 'Discussed price' });
  });

  it('returns [] when there is no Communications Log section', () => {
    const md = `## Inspection History\n| Date | Type |\n|---|---|\n| 2026-01-10 | Open |`;
    expect(parseCommunicationsTable(md)).toEqual([]);
  });
});

describe('parseChecklist', () => {
  it('maps [ ], [~], [x] to todo/doing/done', () => {
    const md = `
- [ ] Photography booked
- [~] Styling in progress
- [x] Listing live
`;
    const items = parseChecklist(md);
    expect(items).toEqual([
      { task: 'Photography booked', status: 'todo', done: false },
      { task: 'Styling in progress', status: 'doing', done: false },
      { task: 'Listing live', status: 'done', done: true },
    ]);
  });
});
