import { NextRequest, NextResponse } from 'next/server';
import { assignToken, revokeToken, getAllTokens, getTokenForSlug } from '@/lib/vendor-tokens';
import { authorised } from '@/lib/agent-auth';

// GET /api/vendor/tokens — list all tokens. Admin-only: this map is the master
// key to every vendor's data, so it must never be served unauthenticated.
export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const tokens = getAllTokens();
  return NextResponse.json({ tokens });
}

// POST /api/vendor/tokens — assign or regenerate token for a property slug
// Body: { slug: string, regenerate?: boolean }
export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  try {
    const { slug, regenerate } = await request.json();

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    if (regenerate) {
      const existing = getTokenForSlug(slug);
      if (existing) revokeToken(existing);
    }

    const token = assignToken(slug);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    return NextResponse.json({
      token,
      slug,
      url: `${baseUrl}/vendor/${token}`,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to assign token' }, { status: 500 });
  }
}
