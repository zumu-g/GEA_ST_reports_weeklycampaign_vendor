import { NextRequest, NextResponse } from 'next/server';
import { appendComment, appendActivity } from '@/lib/markdown-loader';

function authorised(request: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) return false;
  const header = request.headers.get('x-agent-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === expected;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;
  const { body } = await request.json();
  const text = String(body || '').trim();
  if (!text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 });

  const entry = await appendComment(slug, { author: 'agent', body: text });
  await appendActivity(slug, { source: 'comment', actor: 'Agent', summary: text.slice(0, 140) });

  return NextResponse.json({ success: true, entry });
}
