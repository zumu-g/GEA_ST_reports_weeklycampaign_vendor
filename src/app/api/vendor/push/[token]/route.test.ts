import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const resolveVendorToken = vi.fn();
const savePushSubscription = vi.fn();
const removePushSubscription = vi.fn();

vi.mock('@/lib/vendor-tokens', () => ({
  resolveVendorToken: (...args: unknown[]) => resolveVendorToken(...args),
}));
vi.mock('@/lib/push', () => ({
  savePushSubscription: (...args: unknown[]) => savePushSubscription(...args),
  removePushSubscription: (...args: unknown[]) => removePushSubscription(...args),
}));

import { POST, DELETE } from './route';

afterEach(() => vi.clearAllMocks());

function req(method: string, body: object) {
  return new NextRequest('http://localhost/api/vendor/push/tok', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ token: 'tok' }) };

describe('POST /api/vendor/push/[token]', () => {
  it('returns 404 for an unknown token', async () => {
    resolveVendorToken.mockReturnValue(null);
    const res = await POST(req('POST', { endpoint: 'x', keys: { p256dh: 'a', auth: 'b' } }), params);
    expect(res.status).toBe(404);
  });

  it('stores a valid subscription', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    const res = await POST(req('POST', { endpoint: 'x', keys: { p256dh: 'a', auth: 'b' } }), params);
    expect(res.status).toBe(200);
    expect(savePushSubscription).toHaveBeenCalledWith('test-slug', { endpoint: 'x', keys: { p256dh: 'a', auth: 'b' } });
  });

  it('returns 400 for a malformed subscription', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    const res = await POST(req('POST', { endpoint: 'x' }), params);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/vendor/push/[token]', () => {
  it('removes the subscription by endpoint', async () => {
    resolveVendorToken.mockReturnValue({ slug: 'test-slug', meta: {} });
    const res = await DELETE(req('DELETE', { endpoint: 'x' }), params);
    expect(res.status).toBe(200);
    expect(removePushSubscription).toHaveBeenCalledWith('test-slug', 'x');
  });
});
