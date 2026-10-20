import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const resolveVendorToken = vi.fn();
const projectOffersForVendor = vi.fn();
const acknowledgeOffer = vi.fn();
const readOffers = vi.fn();

vi.mock('@/lib/vendor-tokens', () => ({
  resolveVendorToken: (...args: unknown[]) => resolveVendorToken(...args),
}));
vi.mock('@/lib/offers', () => ({
  projectOffersForVendor: (...args: unknown[]) => projectOffersForVendor(...args),
  acknowledgeOffer: (...args: unknown[]) => acknowledgeOffer(...args),
  readOffers: (...args: unknown[]) => readOffers(...args),
}));

import { GET, POST } from './route';

afterEach(() => vi.clearAllMocks());

function req(method: string, body?: object) {
  return new NextRequest('http://localhost/api/vendor/offers/tok', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const params = { params: Promise.resolve({ token: 'tok' }) };

describe('GET /api/vendor/offers/[token]', () => {
  it('returns 404 for an unknown token', async () => {
    resolveVendorToken.mockReturnValue(null);
    const res = await GET(req('GET'), params);
    expect(res.status).toBe(404);
  });

  it('returns the projected offers for a known token', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    projectOffersForVendor.mockResolvedValue([{ id: '1', buyerDisplayName: 'Priya' }]);
    const res = await GET(req('GET'), params);
    const body = await res.json();
    expect(body.offers).toHaveLength(1);
  });
});

describe('POST /api/vendor/offers/[token]', () => {
  it('acknowledges an offer that belongs to this token\'s property', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    readOffers.mockResolvedValue([{ id: '1' }]);
    acknowledgeOffer.mockResolvedValue({ id: '1', status: 'received' });
    const res = await POST(req('POST', { offerId: '1' }), params);
    expect(res.status).toBe(200);
    expect(acknowledgeOffer).toHaveBeenCalledWith('test-slug', '1', undefined);
  });

  it('returns 404 — not an error that reveals it exists elsewhere — for an offerId belonging to a different property', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    readOffers.mockResolvedValue([{ id: 'some-other-id' }]);
    const res = await POST(req('POST', { offerId: 'not-this-propertys-offer' }), params);
    expect(res.status).toBe(404);
    expect(acknowledgeOffer).not.toHaveBeenCalled();
  });

  it('returns 400 when offerId is missing', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    const res = await POST(req('POST', {}), params);
    expect(res.status).toBe(400);
  });
});
