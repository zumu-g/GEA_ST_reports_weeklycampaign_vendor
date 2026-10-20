import { describe, it, expect } from 'vitest';
import { formatBenchmarksTable, parseBenchmarksTable, fetchBenchmarks, type Benchmark } from '../benchmarks';

describe('benchmarks', () => {
  describe('fetchBenchmarks', () => {
    it('returns [] when no snapshot exists yet', async () => {
      expect(await fetchBenchmarks(700_000, null)).toEqual([]);
      expect(await fetchBenchmarks(700_000, { listings: [] })).toEqual([]);
    });

    it('returns a competing-listings count and a median asking-price benchmark', async () => {
      const benchmarks = await fetchBenchmarks(700_000, {
        listings: [
          { askingLow: 650_000, askingHigh: 680_000 },
          { askingLow: 700_000, askingHigh: 720_000 },
          { askingLow: 690_000, askingHigh: 710_000 },
        ],
      });
      expect(benchmarks).toHaveLength(2);
      expect(benchmarks[0]).toMatchObject({ metric: 'Competing Listings', listingValue: 3 });
      expect(benchmarks[1]).toMatchObject({ metric: 'Asking Price', listingValue: 700_000, bracketMedian: 710_000 });
    });

    it('omits the Asking Price row when no listing has a numeric price', async () => {
      const benchmarks = await fetchBenchmarks(700_000, { listings: [{ askingLow: null, askingHigh: null }] });
      expect(benchmarks).toHaveLength(1);
      expect(benchmarks[0].metric).toBe('Competing Listings');
    });
  });

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
