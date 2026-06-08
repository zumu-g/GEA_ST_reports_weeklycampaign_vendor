import { NextRequest, NextResponse } from 'next/server';
import { readNotes, appendNotes } from '@/lib/markdown-loader';

// Agent-only, private notes. Gated by AGENT_API_KEY. These are NOT exposed to
// the vendor and deliberately do NOT write to the activity feed or comments.

function authorised(request: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) return false;
  const header =
    request.headers.get('x-agent-key') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === expected;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;
  const notes = await readNotes(slug);
  // newest first
  notes.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return NextResponse.json({ notes });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;
  const { body, author } = await request.json();
  const text = String(body || '').trim();
  if (!text) return NextResponse.json({ error: 'Empty note' }, { status: 400 });

  const entry = await appendNotes(slug, { body: text, author });
  return NextResponse.json({ success: true, entry });
}
