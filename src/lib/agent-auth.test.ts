import { describe, it, expect, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import {
  authorised,
  signAdminSession,
  verifyAdminSession,
  ADMIN_SESSION_COOKIE,
} from './agent-auth';

function req(headers: Record<string, string> = {}, cookies: Record<string, string> = {}): NextRequest {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  const allHeaders = cookieHeader ? { ...headers, cookie: cookieHeader } : headers;
  return {
    headers: new Headers(allHeaders),
    cookies: {
      get: (name: string) => (cookies[name] !== undefined ? { name, value: cookies[name] } : undefined),
    },
  } as unknown as NextRequest;
}

const origKey = process.env.AGENT_API_KEY;
afterEach(() => {
  process.env.AGENT_API_KEY = origKey;
});

describe('authorised (header path — pre-existing behaviour, characterized before cookie support was added)', () => {
  it('accepts the correct x-agent-key', () => {
    process.env.AGENT_API_KEY = 'secret';
    expect(authorised(req({ 'x-agent-key': 'secret' }))).toBe(true);
  });

  it('accepts a matching Bearer token', () => {
    process.env.AGENT_API_KEY = 'secret';
    expect(authorised(req({ authorization: 'Bearer secret' }))).toBe(true);
  });

  it('rejects a missing or wrong key', () => {
    process.env.AGENT_API_KEY = 'secret';
    expect(authorised(req())).toBe(false);
    expect(authorised(req({ 'x-agent-key': 'wrong' }))).toBe(false);
  });

  it('fails closed when AGENT_API_KEY is unset', () => {
    delete process.env.AGENT_API_KEY;
    expect(authorised(req({ 'x-agent-key': 'anything' }))).toBe(false);
  });
});

describe('admin session cookie', () => {
  it('signs and verifies a fresh session', () => {
    process.env.AGENT_API_KEY = 'secret';
    const cookie = signAdminSession(Date.now());
    expect(verifyAdminSession(cookie)).toBe(true);
  });

  it('rejects a tampered cookie', () => {
    process.env.AGENT_API_KEY = 'secret';
    const cookie = signAdminSession(Date.now());
    expect(verifyAdminSession(cookie.slice(0, -1) + 'x')).toBe(false);
  });

  it('rejects an expired cookie (older than the max-age)', () => {
    process.env.AGENT_API_KEY = 'secret';
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const cookie = signAdminSession(eightDaysAgo);
    expect(verifyAdminSession(cookie)).toBe(false);
  });

  it('rejects a missing cookie', () => {
    process.env.AGENT_API_KEY = 'secret';
    expect(verifyAdminSession(undefined)).toBe(false);
  });

  it('rejects when AGENT_API_KEY is unset (key rotated/removed invalidates all sessions)', () => {
    process.env.AGENT_API_KEY = 'secret';
    const cookie = signAdminSession(Date.now());
    delete process.env.AGENT_API_KEY;
    expect(verifyAdminSession(cookie)).toBe(false);
  });

  it('authorised() accepts a valid session cookie with no header key', () => {
    process.env.AGENT_API_KEY = 'secret';
    const cookie = signAdminSession(Date.now());
    expect(authorised(req({}, { [ADMIN_SESSION_COOKIE]: cookie }))).toBe(true);
  });
});
