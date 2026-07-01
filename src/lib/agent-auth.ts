import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Constant-time comparison so an attacker can't recover the key byte-by-byte
// from response timing. timingSafeEqual requires equal-length buffers, so the
// length pre-check is intentional (and itself leaks only length, not content).
function safeEqual(a: string, b: string): boolean {
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

// Agent/admin-only endpoints. Fails closed: if AGENT_API_KEY is unset, no
// request is authorised. Accepts either `x-agent-key` or a Bearer token.
export function authorised(request: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) return false;
  return safeEqual(headerKey(request, 'x-agent-key'), expected);
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
