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

  // API routes call authorised() themselves (header OR cookie) with the real
  // key/signature check — every matched route (properties/create, agent/*)
  // already gates itself. A proxy-level pre-check here could only validate
  // header *presence*, not correctness, which would silently no-op for a
  // present-but-wrong key; that's worse than no check, since it reads as a
  // real gate without being one. Pass through and let the route decide.
  if (pathname.startsWith('/api/')) {
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
