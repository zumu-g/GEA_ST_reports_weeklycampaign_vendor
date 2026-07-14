import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import proxy from './proxy';
import { signAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/agent-auth';

const origKey = process.env.AGENT_API_KEY;
afterEach(() => {
  process.env.AGENT_API_KEY = origKey;
});

function pageReq(path: string, cookieValue?: string) {
  const headers: Record<string, string> = {};
  if (cookieValue) headers.cookie = `${ADMIN_SESSION_COOKIE}=${cookieValue}`;
  return new NextRequest(`http://localhost${path}`, { headers });
}

function apiReq(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe('proxy', () => {
  it('redirects an unauthenticated /admin/* page request to /admin/login', () => {
    process.env.AGENT_API_KEY = 'secret';
    const res = proxy(pageReq('/admin/onboard'));
    expect(res.status).toBe(307); // NextResponse.redirect default
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('does not redirect /admin/login itself (avoids a redirect loop)', () => {
    process.env.AGENT_API_KEY = 'secret';
    const res = proxy(pageReq('/admin/login'));
    expect(res.status).not.toBe(307);
  });

  it('allows an /admin/* page request with a valid session cookie', () => {
    process.env.AGENT_API_KEY = 'secret';
    const cookie = signAdminSession(Date.now());
    const res = proxy(pageReq('/admin/onboard', cookie));
    expect(res.status).not.toBe(307);
  });

  // Matched API routes (properties/create, agent/*) always pass through the
  // proxy unconditionally — they gate themselves via authorised(), which
  // does the real header/cookie validation. A proxy-level presence-only
  // check would misleadingly look like a real gate without being one.
  it('passes through a matched API route with no auth at all (route gates itself)', () => {
    process.env.AGENT_API_KEY = 'secret';
    const res = proxy(apiReq('/api/properties/create'));
    expect(res.status).not.toBe(401);
  });

  it('passes through a matched API route with a wrong key (route rejects it, not the proxy)', () => {
    process.env.AGENT_API_KEY = 'secret';
    const res = proxy(apiReq('/api/properties/create', { 'x-agent-key': 'wrong' }));
    expect(res.status).not.toBe(401);
  });
});
