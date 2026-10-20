import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const resolveVendorToken = vi.fn();
const readOpens = vi.fn();
const readActivity = vi.fn();
const getLiveStats = vi.fn();
const readBuyers = vi.fn();

vi.mock('@/lib/vendor-tokens', () => ({
  resolveVendorToken: (...args: unknown[]) => resolveVendorToken(...args),
}));
vi.mock('@/lib/markdown-loader', () => ({
  readOpens: (...args: unknown[]) => readOpens(...args),
  readActivity: (...args: unknown[]) => readActivity(...args),
  getLiveStats: (...args: unknown[]) => getLiveStats(...args),
}));
vi.mock('@/lib/buyers', () => ({
  readBuyers: (...args: unknown[]) => readBuyers(...args),
}));

import { GET } from './route';

afterEach(() => vi.clearAllMocks());

function req() {
  return new NextRequest('http://localhost/api/vendor/live/tok');
}
const params = { params: Promise.resolve({ token: 'tok' }) };

describe('GET /api/vendor/live/[token]', () => {
  it('returns 404 for an unknown token and reads nothing', async () => {
    resolveVendorToken.mockReturnValue(null);
    const res = await GET(req(), params);
    expect(res.status).toBe(404);
    expect(readOpens).not.toHaveBeenCalled();
  });

  it('reports an open in progress and the live group count', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    readOpens.mockResolvedValue([
      { id: 'o1', attendance: { status: 'open', checkins: [{ ts: 'x' }, { ts: 'y' }] } },
      { id: 'o2', attendance: { status: 'closed', checkins: [{ ts: 'z' }] } },
    ]);
    readActivity.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    getLiveStats.mockResolvedValue({ bySource: [], asAt: '2026-10-21T00:00:00Z' });
    readBuyers.mockResolvedValue([{ id: 'b1', private: false }, { id: 'b2', private: true }]);

    const res = await GET(req(), params);
    const body = await res.json();
    expect(body).toEqual({
      openInProgress: true,
      groupsNow: 2,
      lastActivityId: 'a2',
      buyerCount: 1,
      statsCapturedAt: '2026-10-21T00:00:00Z',
    });
  });

  it('reports no open in progress and a byte-identical payload across two calls with no writes between them', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    readOpens.mockResolvedValue([]);
    readActivity.mockResolvedValue([]);
    getLiveStats.mockResolvedValue(null);
    readBuyers.mockResolvedValue([]);

    const res1 = await GET(req(), params);
    const body1 = await res1.json();
    const res2 = await GET(req(), params);
    const body2 = await res2.json();
    expect(body1).toEqual(body2);
    expect(body1.openInProgress).toBe(false);
  });
});
