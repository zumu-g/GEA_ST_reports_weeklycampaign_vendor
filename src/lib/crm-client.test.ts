import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const BASE = 'https://crm.test';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Load a fresh copy of the module with the given env. */
async function loadClient(env: { base?: string; token?: string }) {
  vi.resetModules();
  if (env.base === undefined) delete process.env.CRM_API_BASE_URL;
  else process.env.CRM_API_BASE_URL = env.base;
  if (env.token === undefined) delete process.env.WEEKLY_REPORT_API_TOKEN;
  else process.env.WEEKLY_REPORT_API_TOKEN = env.token;
  return import('@/lib/crm-client');
}

describe('crm-client (configured)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves by vaultId (happy path) with a Bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ listingId: 'lst_1', vaultExternalId: 'VRE-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const { resolveListing } = await loadClient({ base: BASE, token: 'tok' });
    const res = await resolveListing({ vaultId: 'VRE-1' });

    expect(res).toEqual({ ok: true, data: { listingId: 'lst_1', vaultExternalId: 'VRE-1' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/report/resolve?vaultId=VRE-1`);
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('treats 404 from resolve as data: null (no match), not an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'No matching listing' }, 404)));
    const { resolveListing } = await loadClient({ base: BASE, token: 'tok' });
    const res = await resolveListing({ address: '14 Nowhere St' });
    expect(res).toEqual({ ok: true, data: null });
  });

  it('maps a full report-listing payload including statsByPortal', async () => {
    const payload = {
      listing: { id: 'lst_1', propertyAddress: '14 Real St', priceGuide: '$1.8m' },
      stats: { views: { value: 515, source: 'crm', capturedAt: '2026-06-15T09:00:00Z', gap: false } },
      statsByPortal: {
        rea: { views: { value: 400, source: 'rea', capturedAt: '2026-06-15T09:00:00Z', gap: false } },
        domain: { views: { value: 115, source: 'domain', capturedAt: '2026-06-15T09:00:00Z', gap: false } },
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(payload)));
    const { getReportListing } = await loadClient({ base: BASE, token: 'tok' });
    const res = await getReportListing('lst_1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data?.statsByPortal.rea.views.value).toBe(400);
      expect(res.data?.statsByPortal.domain.views.value).toBe(115);
    }
  });

  it('returns a typed failure on 401 (bad token)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Unauthorised' }, 401)));
    const { getReportListing } = await loadClient({ base: BASE, token: 'bad' });
    const res = await getReportListing('lst_1');
    expect(res).toEqual({ ok: false, error: 'CRM API error 401', status: 401 });
  });

  it('returns a typed failure (no throw) on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const { getReportListing } = await loadClient({ base: BASE, token: 'tok' });
    const res = await getReportListing('lst_1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('CRM request failed');
  });
});

describe('crm-client (not configured)', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it('returns a typed failure when token/base are missing — and never calls fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { resolveListing, isCrmConfigured } = await loadClient({ base: undefined, token: undefined });
    expect(isCrmConfigured()).toBe(false);
    const res = await resolveListing({ vaultId: 'VRE-1' });
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
