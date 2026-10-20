import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const readOffers = vi.fn();
const addOffer = vi.fn();
const updateOfferStatus = vi.fn();

vi.mock('@/lib/offers', () => ({
  readOffers: (...args: unknown[]) => readOffers(...args),
  addOffer: (...args: unknown[]) => addOffer(...args),
  updateOfferStatus: (...args: unknown[]) => updateOfferStatus(...args),
}));

import { GET, POST } from './route';

const origKey = process.env.AGENT_API_KEY;
beforeEach(() => { process.env.AGENT_API_KEY = 'agent-secret'; });
afterEach(() => { process.env.AGENT_API_KEY = origKey; vi.clearAllMocks(); });

function req(method: string, body?: object, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/agent/offers/test-slug', {
    method,
    headers: { 'Content-Type': 'application/json', 'x-agent-key': 'agent-secret', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const params = { params: Promise.resolve({ slug: 'test-slug' }) };

describe('GET /api/agent/offers/[slug]', () => {
  it('returns 401 without the agent key', async () => {
    const res = await GET(req('GET', undefined, { 'x-agent-key': '' }), params);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/agent/offers/[slug]', () => {
  it('adds a new offer when buyerFirstName and amount are given', async () => {
    addOffer.mockResolvedValue({ id: '1', status: 'received' });
    const res = await POST(req('POST', { buyerFirstName: 'Priya', amount: 705000, conditions: 'finance' }), params);
    expect(res.status).toBe(200);
    expect(addOffer).toHaveBeenCalledWith('test-slug', expect.objectContaining({ buyerFirstName: 'Priya', amount: 705000 }));
  });

  it('returns 400 when buyerFirstName is missing', async () => {
    const res = await POST(req('POST', { amount: 705000 }), params);
    expect(res.status).toBe(400);
    expect(addOffer).not.toHaveBeenCalled();
  });

  it('updates status when offerId and status are given', async () => {
    updateOfferStatus.mockResolvedValue({ id: '1', status: 'accepted' });
    const res = await POST(req('POST', { offerId: '1', status: 'accepted' }), params);
    expect(res.status).toBe(200);
    expect(updateOfferStatus).toHaveBeenCalledWith('test-slug', '1', 'accepted');
  });

  it('returns 409 when the status change targets an already-settled offer', async () => {
    updateOfferStatus.mockRejectedValue(new Error('Offer already settled'));
    const res = await POST(req('POST', { offerId: '1', status: 'accepted' }), params);
    expect(res.status).toBe(409);
  });
});
