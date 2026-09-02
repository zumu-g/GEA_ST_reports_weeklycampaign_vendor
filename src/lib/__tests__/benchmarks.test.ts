import { describe, it, expect } from 'vitest';
import { formatBenchmarksTable, parseBenchmarksTable, type Benchmark } from '../benchmarks';

describe('benchmarks', () => {
  describe('formatBenchmarksTable', () => {
    it('returns empty string for empty benchmarks array', () => {
      expect(formatBenchmarksTable([])).toBe('');
    });

    it('formats benchmarks as a markdown table', () => {
      const benchmarks: Benchmark[] = [
        {
          metric: 'Views',
          listingValue: 412,
          suburbMedian: 260,
          bracketMedian: 280,
          capturedAt: '2026-08-24T10:30:00Z',
          source: 'everypropertyai',
        },
        {
          metric: 'Enquiries',
          listingValue: 8,
          suburbMedian: 5,
          bracketMedian: 6,
          capturedAt: '2026-08-24T10:30:00Z',
          source: 'everypropertyai',
        },
      ];

      const table = formatBenchmarksTable(benchmarks);
      expect(table).toContain('| Metric | Your Listing | Suburb Median | Price Bracket | Captured At | Source |');
      expect(table).toContain('| Views | 412 | 260 | 280 | 2026-08-24 | everypropertyai |');
      expect(table).toContain('| Enquiries | 8 | 5 | 6 | 2026-08-24 | everypropertyai |');
    });

    it('handles null benchmarks (missing data)', () => {
      const benchmarks: Benchmark[] = [
        {
          metric: 'Views',
          listingValue: 412,
          suburbMedian: null,
          bracketMedian: 280,
          capturedAt: '2026-08-24T10:30:00Z',
          source: 'everypropertyai',
        },
      ];

      const table = formatBenchmarksTable(benchmarks);
      expect(table).toContain('| Views | 412 | — | 280 | 2026-08-24 | everypropertyai |');
    });
  });

  describe('parseBenchmarksTable', () => {
    it('returns empty array when no Benchmarks section exists', () => {
      const content = '# Property\n## Analytics Summary\n| Week Ending | Views |\n|---|---|\n| 2026-08-24 | 100 |';
      expect(parseBenchmarksTable(content)).toEqual([]);
    });

    it('parses a benchmarks table from markdown', () => {
      const content = `# Property

## Benchmarks
| Metric | Your Listing | Suburb Median | Price Bracket | Captured At | Source |
|--------|-------------|---------------|--------------|------------|--------|
| Views | 412 | 260 | 280 | 2026-08-24 | everypropertyai |
| Enquiries | 8 | 5 | 6 | 2026-08-24 | everypropertyai |

## Analytics Summary
| Week Ending | Views |
|---|---|
| 2026-08-24 | 100 |
`;
      const benchmarks = parseBenchmarksTable(content);
      expect(benchmarks).toHaveLength(2);
      expect(benchmarks[0]).toEqual({
        metric: 'Views',
        listingValue: 412,
        suburbMedian: 260,
        bracketMedian: 280,
        capturedAt: '2026-08-24T00:00:00Z',
        source: 'everypropertyai',
      });
    });

    it('handles null values (shown as — in markdown)', () => {
      const content = `# Property

## Benchmarks
| Metric | Your Listing | Suburb Median | Price Bracket | Captured At | Source |
|--------|-------------|---------------|--------------|------------|--------|
| Views | 412 | — | 280 | 2026-08-24 | everypropertyai |
`;
      const benchmarks = parseBenchmarksTable(content);
      expect(benchmarks).toHaveLength(1);
      expect(benchmarks[0].suburbMedian).toBeNull();
      expect(benchmarks[0].bracketMedian).toBe(280);
    });

    it('ignores malformed rows', () => {
      const content = `# Property

## Benchmarks
| Metric | Your Listing | Suburb Median | Price Bracket | Captured At | Source |
|--------|-------------|---------------|--------------|------------|--------|
| Views | 412 | 260 | 280 | 2026-08-24 | everypropertyai |
| Broken | abc | 260 | 280 | 2026-08-24 | everypropertyai |
| Enquiries | 8 | 5 | 6 | 2026-08-24 | everypropertyai |
`;
      const benchmarks = parseBenchmarksTable(content);
      expect(benchmarks).toHaveLength(2);
      expect(benchmarks[0].metric).toBe('Views');
      expect(benchmarks[1].metric).toBe('Enquiries');
    });
  });
});
