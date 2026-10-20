import { NextRequest, NextResponse } from 'next/server';
import { authorised } from '@/lib/agent-auth';
import { checkinGroup, undoLastCheckin, closeOpen } from '@/lib/markdown-loader';
import { upsertBuyer } from '@/lib/buyers';

// POST { action: 'checkin' | 'undo' | 'close', firstName?, position?, interest? }
// A door check-in is one tap per group; an optional buyer name/position adds
// a linked buyer record via buyers.ts in the same call (U3, R2, R10).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; openId: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug, openId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  try {
    if (action === 'checkin') {
      let buyerId: string | undefined;
      if (body.firstName) {
        const buyer = await upsertBuyer(slug, {
          firstName: String(body.firstName),
          position: body.position,
          interest: body.interest,
          source: 'agent',
        });
        buyerId = buyer.id;
      }
      const open = await checkinGroup(slug, openId, buyerId);
      return NextResponse.json({ success: true, open });
    }
    if (action === 'undo') {
      const open = await undoLastCheckin(slug, openId);
      return NextResponse.json({ success: true, open });
    }
    if (action === 'close') {
      const open = await closeOpen(slug, openId);
      return NextResponse.json({ success: true, open });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Check-in failed';
    const status = message === 'Open not found' ? 404 : message === 'Open already closed' ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
