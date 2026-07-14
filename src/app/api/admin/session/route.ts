import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_MS, signAdminSession, safeEqual } from '@/lib/agent-auth';

// ponytail: a plain per-process delay, not a persistent rate-limit store —
// slows online guessing against the single admin secret without adding
// infrastructure. Restarts reset it; acceptable for a single-agent tool.
async function loginDelay(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 500));
}

export async function POST(request: NextRequest) {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: 'Admin login not configured' }, { status: 503 });
  }

  const { key } = await request.json();
  if (typeof key !== 'string' || !safeEqual(key, expected)) {
    await loginDelay();
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, signAdminSession(Date.now()), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_MAX_AGE_MS / 1000,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(ADMIN_SESSION_COOKIE);
  return res;
}
