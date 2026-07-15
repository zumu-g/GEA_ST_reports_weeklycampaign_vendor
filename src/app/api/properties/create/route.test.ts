import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const createPropertyFolder = vi.fn().mockResolvedValue(undefined);
const assignToken = vi.fn().mockReturnValue('fake-token');
vi.mock('@/lib/markdown-loader', () => ({ createPropertyFolder: (...args: unknown[]) => createPropertyFolder(...args) }));
vi.mock('@/lib/vendor-tokens', () => ({ assignToken: (...args: unknown[]) => assignToken(...args) }));

import { POST } from './route';

const origKey = process.env.AGENT_API_KEY;
afterEach(() => {
  process.env.AGENT_API_KEY = origKey;
  createPropertyFolder.mockClear();
  assignToken.mockClear();
});

function req(body: object, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/properties/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/properties/create (auth gate)', () => {
  it('rejects an unauthenticated request without touching the filesystem (the audit gap this closes)', async () => {
    process.env.AGENT_API_KEY = 'secret';
    const res = await POST(req({ address: '1 Test St', owner: 'Someone' }));
    expect(res.status).toBe(401);
    expect(createPropertyFolder).not.toHaveBeenCalled();
    expect(assignToken).not.toHaveBeenCalled();
  });

  it('accepts a request with a valid x-agent-key', async () => {
    process.env.AGENT_API_KEY = 'secret';
    const res = await POST(req({ address: '1 Test St', owner: 'Someone' }, { 'x-agent-key': 'secret' }));
    expect(res.status).toBe(201);
    expect(createPropertyFolder).toHaveBeenCalledOnce();
  });
});
