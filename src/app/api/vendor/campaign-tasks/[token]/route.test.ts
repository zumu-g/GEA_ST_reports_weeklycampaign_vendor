import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const resolveVendorToken = vi.fn();
const getRentalSlugForToken = vi.fn();

vi.mock('@/lib/vendor-tokens', () => ({
  resolveVendorToken: (...args: unknown[]) => resolveVendorToken(...args),
}));
vi.mock('@/lib/rental-tokens', () => ({
  getRentalSlugForToken: (...args: unknown[]) => getRentalSlugForToken(...args),
}));

import { GET } from './route';

const origKey = process.env.CLICKUP_API_KEY;
afterEach(() => {
  process.env.CLICKUP_API_KEY = origKey;
  vi.clearAllMocks();
});

function req(token: string) {
  return new NextRequest(`http://localhost/api/vendor/campaign-tasks/${token}`);
}

describe('GET /api/vendor/campaign-tasks/[token]', () => {
  it('returns 404 for a token unknown to both the vendor and rental stores', async () => {
    resolveVendorToken.mockReturnValue(null);
    getRentalSlugForToken.mockReturnValue(null);
    const res = await GET(req('unknown'), { params: Promise.resolve({ token: 'unknown' }) });
    expect(res.status).toBe(404);
  });

  it('falls back to the rental token store for a landlord token', async () => {
    resolveVendorToken.mockReturnValue(null);
    getRentalSlugForToken.mockReturnValue('85-centenary-blvd-officer-south');
    const res = await GET(req('tok'), { params: Promise.resolve({ token: 'tok' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tasks).toEqual([]); // no CLICKUP_API_KEY in test env
  });

  it('returns an empty task list for a known token with no ClickUp list mapped', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'no-list-mapped-slug', meta: {} });
    const res = await GET(req('tok'), { params: Promise.resolve({ token: 'tok' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tasks).toEqual([]);
  });

  it('returns an empty task list when CLICKUP_API_KEY is unset, even with a mapped list', async () => {
    delete process.env.CLICKUP_API_KEY;
    resolveVendorToken.mockReturnValue({ slug: '85-centenary-blvd-officer-south', meta: {} });
    const res = await GET(req('tok'), { params: Promise.resolve({ token: 'tok' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tasks).toEqual([]);
  });
});
