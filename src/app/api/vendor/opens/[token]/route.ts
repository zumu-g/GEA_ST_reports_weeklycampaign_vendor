import { NextRequest, NextResponse } from 'next/server';
import { getPropertySlugForToken } from '@/lib/vendor-tokens';
import { readOpens } from '@/lib/markdown-loader';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const slug = getPropertySlugForToken(token);
  if (!slug) return NextResponse.json({ opens: [] }, { status: 404 });

  const now = Date.now();
  const opens = (await readOpens(slug))
    .filter(o => new Date(o.start).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 4);

  return NextResponse.json({ opens });
}
