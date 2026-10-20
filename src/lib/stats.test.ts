import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { readStats, upsertStats, getLiveStats, effectiveCapturedAt } from './markdown-loader';

const SLUG = 'test-stats-slug';
const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-stats-'));
  process.env.PROPERTIES_DIR = tmp;
  await fs.mkdir(path.join(tmp, SLUG), { recursive: true });
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('effectiveCapturedAt', () => {
  it('uses capturedAt when present', () => {
    expect(effectiveCapturedAt({ weekEnding: '2026-10-18', capturedAt: '2026-10-19T08:00:00Z' })).toBe('2026-10-19T08:00:00Z');
  });

  it('falls back to the end of the week when capturedAt is absent', () => {
    expect(effectiveCapturedAt({ weekEnding: '2026-10-18' })).toBe('2026-10-18T23:59:59.999Z');
  });
});

describe('upsertStats', () => {
  it('keeps two rows for the same source captured on different calendar dates', async () => {
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 10, enquiries: 1, saves: 0, capturedAt: '2026-10-21T08:00:00Z' });
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 15, enquiries: 2, saves: 0, capturedAt: '2026-10-22T08:00:00Z' });
    const rows = await readStats(SLUG);
    expect(rows).toHaveLength(2);
  });

  it('replaces the row for the same source captured on the same calendar date', async () => {
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 10, enquiries: 1, saves: 0, capturedAt: '2026-10-22T08:00:00Z' });
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 15, enquiries: 2, saves: 0, capturedAt: '2026-10-22T18:00:00Z' });
    const rows = await readStats(SLUG);
    expect(rows).toHaveLength(1);
    expect(rows[0].views).toBe(15);
  });

  it('treats a legacy weekEnding-only row and a capturedAt row for the next week as distinct', async () => {
    await upsertStats(SLUG, { weekEnding: '2026-10-11', source: 'domain', views: 5, enquiries: 0, saves: 0 });
    await upsertStats(SLUG, { weekEnding: '2026-10-18', source: 'domain', views: 8, enquiries: 1, saves: 0 });
    const rows = await readStats(SLUG);
    expect(rows).toHaveLength(2);
  });

  it('stores an optional shares figure', async () => {
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 10, enquiries: 1, saves: 0, shares: 4 });
    const [row] = await readStats(SLUG);
    expect(row.shares).toBe(4);
  });
});

describe('getLiveStats', () => {
  it('returns week-over-week deltas against the latest row at least 7 days earlier, not the immediately prior row', async () => {
    // 10-20 is only 1 day before 10-21, so it's skipped; 10-13 is 8 days before.
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 100, enquiries: 10, saves: 0, capturedAt: '2026-10-13T00:00:00Z' });
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 150, enquiries: 15, saves: 0, capturedAt: '2026-10-20T00:00:00Z' });
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 200, enquiries: 18, saves: 0, capturedAt: '2026-10-21T00:00:00Z' });

    const stats = await getLiveStats(SLUG);
    const rea = stats?.bySource.find(s => s.source === 'rea');
    expect(rea?.views).toBe(200);
    expect(rea?.viewsDelta).toBe(100); // 200 - 100 (the 10-13 row), not 200 - 150 (the nearer 10-20 row)
  });

  it('returns one entry per source, including grantsea once present', async () => {
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 10, enquiries: 1, saves: 0 });
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'domain', views: 20, enquiries: 2, saves: 0 });
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'grantsea', views: 5, enquiries: 0, saves: 0 });
    const stats = await getLiveStats(SLUG);
    expect(stats?.bySource.map(s => s.source).sort()).toEqual(['domain', 'grantsea', 'rea']);
  });

  it('returns null when no stats exist', async () => {
    expect(await getLiveStats(SLUG)).toBeNull();
  });

  it('asAt is the oldest capturedAt among each source\'s latest row', async () => {
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'rea', views: 10, enquiries: 1, saves: 0, capturedAt: '2026-10-21T08:00:00Z' });
    await upsertStats(SLUG, { weekEnding: '2026-10-22', source: 'domain', views: 20, enquiries: 2, saves: 0, capturedAt: '2026-10-19T08:00:00Z' });
    const stats = await getLiveStats(SLUG);
    expect(stats?.asAt).toBe('2026-10-19T08:00:00Z');
  });
});
