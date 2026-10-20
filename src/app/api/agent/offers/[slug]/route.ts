import { NextRequest, NextResponse } from 'next/server';
import { authorised } from '@/lib/agent-auth';
import { readOffers, addOffer, updateOfferStatus, type OfferStatus } from '@/lib/offers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;
  const offers = await readOffers(slug);
  return NextResponse.json({ offers });
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

  try {
    if (body.offerId && body.status) {
      const offer = await updateOfferStatus(slug, body.offerId, body.status as OfferStatus);
      return NextResponse.json({ success: true, offer });
    }

    const buyerFirstName = String(body.buyerFirstName || '').trim();
    const amount = Number(body.amount);
    if (!buyerFirstName || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'buyerFirstName and amount are required' }, { status: 400 });
    }
    const offer = await addOffer(slug, {
      buyerFirstName,
      amount,
      conditions: String(body.conditions || ''),
      settlementDays: body.settlementDays != null ? Number(body.settlementDays) : undefined,
      expiry: body.expiry,
    });
    return NextResponse.json({ success: true, offer });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    const status = message === 'Offer not found' ? 404 : message === 'Offer already settled' ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
