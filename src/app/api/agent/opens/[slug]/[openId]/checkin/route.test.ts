import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const checkinGroup = vi.fn();
const undoLastCheckin = vi.fn();
const closeOpen = vi.fn();
const upsertBuyer = vi.fn();

vi.mock('@/lib/markdown-loader', () => ({
  checkinGroup: (...args: unknown[]) => checkinGroup(...args),
  undoLastCheckin: (...args: unknown[]) => undoLastCheckin(...args),
  closeOpen: (...args: unknown[]) => closeOpen(...args),
}));
vi.mock('@/lib/buyers', () => ({
  upsertBuyer: (...args: unknown[]) => upsertBuyer(...args),
}));

import { POST } from './route';

const origKey = process.env.AGENT_API_KEY;
beforeEach(() => {
  process.env.AGENT_API_KEY = 'agent-secret';
});
afterEach(() => {
  process.env.AGENT_API_KEY = origKey;
  vi.clearAllMocks();
});

function req(body: object, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/agent/opens/test-slug/open-1/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-key': 'agent-secret', ...headers },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ slug: 'test-slug', openId: 'open-1' }) };

describe('POST checkin', () => {
  it('returns 401 without the agent key', async () => {
    const res = await POST(req({ action: 'checkin' }, { 'x-agent-key': '' }), params);
    expect(res.status).toBe(401);
    expect(checkinGroup).not.toHaveBeenCalled();
  });

  it('checks in a group with no buyer when firstName is absent', async () => {
    checkinGroup.mockResolvedValue({ id: 'open-1', attendance: { checkins: [{ ts: 'x' }], status: 'open' } });
    const res = await POST(req({ action: 'checkin' }), params);
    expect(res.status).toBe(200);
    expect(upsertBuyer).not.toHaveBeenCalled();
    expect(checkinGroup).toHaveBeenCalledWith('test-slug', 'open-1', undefined);
  });

  it('upserts a buyer and links the check-in when firstName is given', async () => {
    upsertBuyer.mockResolvedValue({ id: 'buyer-1' });
    checkinGroup.mockResolvedValue({ id: 'open-1', attendance: { checkins: [{ ts: 'x', buyerId: 'buyer-1' }], status: 'open' } });
    const res = await POST(req({ action: 'checkin', firstName: 'Priya', position: 'cash' }), params);
    expect(res.status).toBe(200);
    expect(upsertBuyer).toHaveBeenCalledWith('test-slug', expect.objectContaining({ firstName: 'Priya', position: 'cash' }));
    expect(checkinGroup).toHaveBeenCalledWith('test-slug', 'open-1', 'buyer-1');
  });

  it('returns 404 for an unknown open', async () => {
    checkinGroup.mockRejectedValue(new Error('Open not found'));
    const res = await POST(req({ action: 'checkin' }), params);
    expect(res.status).toBe(404);
  });

  it('returns 409 when closing an already-closed open', async () => {
    closeOpen.mockRejectedValue(new Error('Open already closed'));
    const res = await POST(req({ action: 'close' }), params);
    expect(res.status).toBe(409);
  });

  it('returns 400 for an unknown action', async () => {
    const res = await POST(req({ action: 'nope' }), params);
    expect(res.status).toBe(400);
  });
});
