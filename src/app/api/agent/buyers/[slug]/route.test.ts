import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const readBuyers = vi.fn();
const upsertBuyer = vi.fn();

vi.mock('@/lib/buyers', () => ({
  readBuyers: (...args: unknown[]) => readBuyers(...args),
  upsertBuyer: (...args: unknown[]) => upsertBuyer(...args),
}));

import { GET, POST } from './route';

const origKey = process.env.AGENT_API_KEY;
beforeEach(() => {
  process.env.AGENT_API_KEY = 'agent-secret';
});
afterEach(() => {
  process.env.AGENT_API_KEY = origKey;
  vi.clearAllMocks();
});

function req(method: string, body?: object, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/agent/buyers/test-slug', {
    method,
    headers: { 'Content-Type': 'application/json', 'x-agent-key': 'agent-secret', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/agent/buyers/[slug]', () => {
  it('returns 401 without the agent key', async () => {
    const res = await GET(req('GET', undefined, { 'x-agent-key': '' }), { params: Promise.resolve({ slug: 'test-slug' }) });
    expect(res.status).toBe(401);
    expect(readBuyers).not.toHaveBeenCalled();
  });

  it('returns the full buyer list, including contact fields', async () => {
    readBuyers.mockResolvedValue([{ id: '1', firstName: 'Priya', phone: '0400000000' }]);
    const res = await GET(req('GET'), { params: Promise.resolve({ slug: 'test-slug' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.buyers[0].phone).toBe('0400000000');
  });
});

describe('POST /api/agent/buyers/[slug]', () => {
  it('returns 400 when firstName is missing', async () => {
    const res = await POST(req('POST', {}), { params: Promise.resolve({ slug: 'test-slug' }) });
    expect(res.status).toBe(400);
    expect(upsertBuyer).not.toHaveBeenCalled();
  });

  it('upserts the buyer and returns it', async () => {
    upsertBuyer.mockResolvedValue({ id: '1', firstName: 'Priya' });
    const res = await POST(req('POST', { firstName: 'Priya', position: 'cash' }), { params: Promise.resolve({ slug: 'test-slug' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(upsertBuyer).toHaveBeenCalledWith('test-slug', expect.objectContaining({ firstName: 'Priya', position: 'cash', source: 'agent' }));
    expect(body.buyer.firstName).toBe('Priya');
  });
});
