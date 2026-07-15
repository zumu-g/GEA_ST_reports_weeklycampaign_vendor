import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Constant-time comparison so an attacker can't recover the key byte-by-byte
// from response timing. timingSafeEqual requires equal-length buffers, so the
// length pre-check is intentional (and itself leaks only length, not content).
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function headerKey(request: NextRequest, name: string): string {
  return (
    request.headers.get(name) ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''
  );
}

export const ADMIN_SESSION_COOKIE = 'gea_admin_session';
// 7 days — long enough that the agent isn't re-logging-in constantly, short
// enough that a leaked cookie isn't a permanent credential.
export const ADMIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Cookie value is `HMAC(AGENT_API_KEY, issuedAt) + '.' + issuedAt`, never the
// raw key — and carrying issuedAt is what lets the session actually expire;
// a static HMAC with no timestamp would be a permanent credential revocable
// only by rotating AGENT_API_KEY.
export function signAdminSession(issuedAt: number): string {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) throw new Error('AGENT_API_KEY not configured');
  const mac = crypto.createHmac('sha256', expected).update(String(issuedAt)).digest('hex');
  return `${mac}.${issuedAt}`;
}

export function verifyAdminSession(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;
  const expected = process.env.AGENT_API_KEY;
  if (!expected) return false;

  const dot = cookieValue.lastIndexOf('.');
  if (dot === -1) return false;
  const mac = cookieValue.slice(0, dot);
  const issuedAtStr = cookieValue.slice(dot + 1);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;

  if (Date.now() - issuedAt > ADMIN_SESSION_MAX_AGE_MS) return false;

  const expectedMac = crypto.createHmac('sha256', expected).update(issuedAtStr).digest('hex');
  return safeEqual(mac, expectedMac);
}

// Agent/admin-only endpoints. Fails closed: if AGENT_API_KEY is unset, no
// request is authorised. Accepts an `x-agent-key`/Bearer header (scripts,
// CRM) OR a valid, non-expired admin session cookie (browser /admin pages).
export function authorised(request: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) return false;
  if (safeEqual(headerKey(request, 'x-agent-key'), expected)) return true;
  return verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

// Ingest endpoints (Open Claw / CRM pipeline). Mirrors the ClickUp webhook
// posture: verify when INGEST_API_KEY is set; in production, refuse when it is
// unset (fail closed); in local/dev leave open for convenience.
//   'ok'           → proceed
//   'unauthorised' → 401 (key set, header missing/wrong)
//   'unconfigured' → 503 (production with no key configured)
export type IngestAuth = 'ok' | 'unauthorised' | 'unconfigured';

export function ingestAuth(request: NextRequest): IngestAuth {
  const expected = process.env.INGEST_API_KEY;
  if (expected) {
    return safeEqual(headerKey(request, 'x-ingest-key'), expected) ? 'ok' : 'unauthorised';
  }
  return process.env.NODE_ENV === 'production' ? 'unconfigured' : 'ok';
}

// Route guard: returns an error response to short-circuit with, or null to
// proceed. Keeps the status mapping in one place across the ingest routes.
export function ingestGuard(request: NextRequest): NextResponse | null {
  const state = ingestAuth(request);
  if (state === 'unauthorised') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (state === 'unconfigured') {
    return NextResponse.json({ error: 'Ingest key not configured' }, { status: 503 });
  }
  return null;
}
