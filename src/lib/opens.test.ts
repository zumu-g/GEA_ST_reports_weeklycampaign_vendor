import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  readOpens,
  upsertOpen,
  checkinGroup,
  undoLastCheckin,
  closeOpen,
  resolveOpenStatus,
  type OpenEntry,
} from './markdown-loader';

const SLUG = 'test-opens-slug';
const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-opens-'));
  process.env.PROPERTIES_DIR = tmp;
  await fs.mkdir(path.join(tmp, SLUG), { recursive: true });
  await fs.writeFile(
    path.join(tmp, SLUG, 'PROPERTY.md'),
    `# Test\n\n## Inspection History\n| Date | Type | Groups | Interest Level | Notes |\n|------|------|--------|-----------------|-------|\n|      |      |        |                 |       |\n`,
    'utf-8'
  );
  await upsertOpen(SLUG, { id: 'open-1', start: '2026-10-21T13:00:00+11:00', end: '2026-10-21T13:30:00+11:00', source: 'manual' });
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  vi.useRealTimers();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('checkinGroup / undoLastCheckin', () => {
  it('adds and undoes check-ins, tracking the group count', async () => {
    await checkinGroup(SLUG, 'open-1');
    await checkinGroup(SLUG, 'open-1');
    await checkinGroup(SLUG, 'open-1');
    let [open] = await readOpens(SLUG);
    expect(open.attendance?.checkins).toHaveLength(3);
    expect(open.attendance?.status).toBe('open');

    await undoLastCheckin(SLUG, 'open-1');
    [open] = await readOpens(SLUG);
    expect(open.attendance?.checkins).toHaveLength(2);
  });

  it('throws Open not found for an unknown id', async () => {
    await expect(checkinGroup(SLUG, 'nope')).rejects.toThrow('Open not found');
  });
});

describe('closeOpen', () => {
  it('writes the inspection file, one Inspection History row, and sets status closed', async () => {
    await checkinGroup(SLUG, 'open-1', 'buyer-1');
    await checkinGroup(SLUG, 'open-1', 'buyer-2');
    await checkinGroup(SLUG, 'open-1');
    await checkinGroup(SLUG, 'open-1');

    const result = await closeOpen(SLUG, 'open-1');
    expect(result.attendance?.status).toBe('closed');

    const content = await fs.readFile(path.join(tmp, SLUG, 'PROPERTY.md'), 'utf-8');
    expect(content).toContain('| 2026-10-21 | Open Home | 4 | Medium |');

    const files = await fs.readdir(path.join(tmp, SLUG, 'inspections'));
    expect(files).toHaveLength(1);
  });

  it('returns 409-worthy error when closing an already-closed open', async () => {
    await closeOpen(SLUG, 'open-1');
    await expect(closeOpen(SLUG, 'open-1')).rejects.toThrow('Open already closed');
  });
});

describe('resolveOpenStatus / readOpens auto-close', () => {
  const staleOpen: OpenEntry = {
    id: 'open-1',
    start: '2026-10-21T13:00:00+11:00',
    end: '2026-10-21T13:30:00+11:00',
    source: 'manual',
    attendance: { checkins: [{ ts: '2026-10-21T13:05:00+11:00' }], status: 'open' },
  };

  it('reports an open as closed once more than two hours past its scheduled end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T16:00:00+11:00')); // 2.5h past end
    expect(resolveOpenStatus(staleOpen).attendance?.status).toBe('closed');
  });

  it('leaves a within-window open as open', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T14:00:00+11:00')); // 30m past end
    expect(resolveOpenStatus(staleOpen).attendance?.status).toBe('open');
  });

  it('readOpens projects the stale status without persisting a write to the stored file', async () => {
    await checkinGroup(SLUG, 'open-1');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T16:00:00+11:00'));

    const [projected] = await readOpens(SLUG);
    expect(projected.attendance?.status).toBe('closed');

    vi.useRealTimers();
    const raw = JSON.parse(await fs.readFile(path.join(tmp, SLUG, 'opens.json'), 'utf-8'));
    expect(raw[0].attendance.status).toBe('open'); // stored file untouched by the read
  });
});
