import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from '@/lib/agent-auth';

// Next 16 renamed the `middleware.ts` convention to `proxy.ts`. This also
// runs on the Node runtime (not Edge, which is middleware.ts's historical
// default) — required because verifyAdminSession uses agent-auth.ts's
// node:crypto HMAC/timingSafeEqual helpers, unavailable on Edge.
export const config = {
  matcher: ['/admin/:path*', '/api/properties/create', '/api/agent/:path*'],
};

const PUBLIC_ADMIN_PATHS = ['/admin/login'];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith('/api/');
  if (isApiRoute) {
    // API routes call authorised() themselves (header OR cookie) — the proxy
    // only needs to short-circuit unauthenticated requests before they reach
    // route handlers that don't already guard themselves, e.g.
    // /api/properties/create, which historically had no auth at all.
    const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const hasHeaderKey = Boolean(
      request.headers.get('x-agent-key') || request.headers.get('authorization')
    );
    if (!hasHeaderKey && !verifyAdminSession(cookie)) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSession(cookie)) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
