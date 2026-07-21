import { NextRequest, NextResponse } from 'next/server';
import { getProperty, updatePropertySection, appendActivity } from '@/lib/markdown-loader';
import { authorised } from '@/lib/agent-auth';
import { getVendorReportComps, type SoldComp, type ListingComp } from '@/lib/everypropertyai';

// Agent-gated: pulls comparable sales / nearby listings from everypropertyai
// and rewrites the "Just Listed Nearby" / "Just Sold Nearby" tables. Property
// Details (Owner/Contact/Listed/Price Guide) is deliberately untouched — those
// are vendor/agent-entered fields everypropertyai has no data for, not
// property attributes an external lookup can fill.

const LISTED_HEADER = '| Address | Price | Type | Date | Beds | Baths | Cars |';
const SOLD_HEADER = '| Address | Price | Type | Date | Beds | Baths | Cars |';

function listingRow(c: ListingComp): string[] {
  return [
    c.rawAddress,
    c.displayPrice ?? '',
    c.propertyType ?? '',
    '',
    c.bedrooms != null ? String(c.bedrooms) : '',
    c.bathrooms != null ? String(c.bathrooms) : '',
    c.carSpaces != null ? String(c.carSpaces) : '',
  ];
}

function soldRow(c: SoldComp): string[] {
  return [
    c.rawAddress,
    c.salePrice != null ? `$${c.salePrice.toLocaleString('en-AU')}` : '',
    c.propertyType ?? '',
    c.saleDate ?? '',
    '',
    '',
    '',
  ];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;

  const property = await getProperty(slug);
  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }

  let comps;
  try {
    comps = await getVendorReportComps({ address: property.address, excludeAddress: property.address });
  } catch (error) {
    // getVendorReportComps already fails soft internally (returns empty
    // arrays on non-200/network error/timeout) — a thrown error here means
    // something unexpected happened in the call itself, not a soft backend
    // failure. Treat it as upstream-unavailable rather than "no results".
    return NextResponse.json({ error: 'everypropertyai unavailable', detail: String(error) }, { status: 502 });
  }

  await updatePropertySection(slug, 'Just Listed Nearby', LISTED_HEADER, comps.listings.map(listingRow));
  await updatePropertySection(slug, 'Just Sold Nearby', SOLD_HEADER, comps.solds.map(soldRow));

  await appendActivity(slug, {
    source: 'enrichment',
    actor: 'Agent',
    summary: `Refreshed nearby listings/sales (${comps.listings.length} listed, ${comps.solds.length} sold)`,
  });

  return NextResponse.json({
    success: true,
    slug,
    listingsFound: comps.listings.length,
    soldsFound: comps.solds.length,
  });
}
