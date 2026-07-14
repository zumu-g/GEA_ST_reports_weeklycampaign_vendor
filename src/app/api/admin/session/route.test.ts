import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, DELETE } from './route';
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/agent-auth';

const origKey = process.env.AGENT_API_KEY;
afterEach(() => {
  process.env.AGENT_API_KEY = origKey;
});

function loginReq(key: string) {
  return new NextRequest('http://localhost/api/admin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
}

describe('POST /api/admin/session', () => {
  it('sets a valid session cookie on a correct key', async () => {
    process.env.AGENT_API_KEY = 'secret';
    const res = await POST(loginReq('secret'));
    expect(res.status).toBe(200);
    const setCookie = res.cookies.get(ADMIN_SESSION_COOKIE);
    expect(setCookie).toBeDefined();
    expect(verifyAdminSession(setCookie!.value)).toBe(true);
  });

  it('rejects a wrong key with 401 and no cookie', async () => {
    process.env.AGENT_API_KEY = 'secret';
    const res = await POST(loginReq('wrong'));
    expect(res.status).toBe(401);
    expect(res.cookies.get(ADMIN_SESSION_COOKIE)).toBeUndefined();
  }, 2000);

  it('returns 503 when AGENT_API_KEY is unset', async () => {
    delete process.env.AGENT_API_KEY;
    const res = await POST(loginReq('anything'));
    expect(res.status).toBe(503);
  });
});

describe('DELETE /api/admin/session', () => {
  it('clears the session cookie', async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(ADMIN_SESSION_COOKIE);
    expect(cookie?.value === '' || cookie === undefined).toBe(true);
  });
});
