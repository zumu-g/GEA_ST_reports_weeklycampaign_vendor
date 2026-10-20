import { NextRequest, NextResponse } from 'next/server';
import { getPropertySlugForToken, getTokenMeta } from '@/lib/vendor-tokens';
import { appendComment, readComments, appendActivity, getProperty } from '@/lib/markdown-loader';
import { sendEmail, renderVendorEmail } from '@/lib/notify-email';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const slug = getPropertySlugForToken(token);
  if (!slug) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const comments = await readComments(slug);
  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const slug = getPropertySlugForToken(token);
  if (!slug) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const { body } = await request.json();
  const text = String(body || '').trim();
  if (!text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: 'Too long' }, { status: 400 });

  const entry = await appendComment(slug, { author: 'vendor', body: text });
  const meta = getTokenMeta(token);
  await appendActivity(slug, {
    source: 'comment',
    actor: meta.ownerName || 'Vendor',
    summary: text.slice(0, 140),
  });

  // Best-effort email notify to agent (if configured) — direct helper call,
  // never a loop back through the now token-only /api/vendor/notify route.
  try {
    const agentEmail = process.env.AGENT_NOTIFY_EMAIL;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`;
    if (agentEmail) {
      const property = await getProperty(slug);
      const address = property?.address || slug;
      const portalUrl = `${baseUrl}/vendor/${token}`;
      const message = `${meta.ownerName || 'A vendor'} posted a new comment: "${text}"`;
      const html = renderVendorEmail({ ownerName: 'Stuart', address, portalUrl, message });
      await sendEmail({ to: agentEmail, subject: `Update on your campaign — ${address}`, html });
    }
  } catch {
    // notification is best-effort
  }

  return NextResponse.json({ success: true, entry });
}
