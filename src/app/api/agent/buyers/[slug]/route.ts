import { NextRequest, NextResponse } from 'next/server';
import { authorised } from '@/lib/agent-auth';
import { readBuyers, upsertBuyer, type BuyerPosition, type BuyerInterest } from '@/lib/buyers';

// GET  — agent-facing full buyer records, including contact fields.
// POST — add or update a buyer (matches by first name) and optionally
//        append a feedback note. PATCH is not needed: upsertBuyer already
//        merges on repeat calls (R10).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;
  const buyers = await readBuyers(slug);
  return NextResponse.json({ buyers });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;
  const body = await request.json();
  const firstName = String(body.firstName || '').trim();
  if (!firstName) {
    return NextResponse.json({ error: 'firstName is required' }, { status: 400 });
  }

  const buyer = await upsertBuyer(slug, {
    firstName,
    fullName: body.fullName,
    phone: body.phone,
    email: body.email,
    position: body.position as BuyerPosition | undefined,
    interest: body.interest as BuyerInterest | undefined,
    private: body.private,
    feedbackNote: body.feedbackNote,
    priceFeedback: body.priceFeedback,
    source: 'agent',
  });

  return NextResponse.json({ success: true, buyer });
}
