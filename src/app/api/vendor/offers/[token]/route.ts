import { NextRequest, NextResponse } from 'next/server';
import { resolveVendorToken } from '@/lib/vendor-tokens';
import { projectOffersForVendor, acknowledgeOffer, readOffers } from '@/lib/offers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resolved = resolveVendorToken(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }
  const offers = await projectOffersForVendor(resolved.slug);
  return NextResponse.json({ offers });
}

// POST { offerId, note? } — acknowledges an offer. This is never acceptance;
// the response text and the vendor UI both say so (R7).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resolved = resolveVendorToken(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const offerId = body.offerId;
  if (!offerId) {
    return NextResponse.json({ error: 'offerId is required' }, { status: 400 });
  }

  try {
    // An offerId belonging to a DIFFERENT property must look the same as an
    // unknown one (404), so a vendor token can never probe another
    // property's offers by guessing ids.
    const allForThisSlug = await readOffers(resolved.slug);
    if (!allForThisSlug.some(o => o.id === offerId)) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }
    const offer = await acknowledgeOffer(resolved.slug, offerId, body.note);
    return NextResponse.json({ success: true, offer: { id: offer.id, status: offer.status, acknowledged: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
