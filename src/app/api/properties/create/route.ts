import { NextRequest, NextResponse } from 'next/server';
import { createPropertyFolder, slugifyAddress } from '@/lib/markdown-loader';
import { assignToken } from '@/lib/vendor-tokens';
import { authorised } from '@/lib/agent-auth';
import { sendEmail, renderVendorEmail } from '@/lib/notify-email';

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { address, owner, contact, listed, priceGuide, campaignType } = body;

    if (!address || !owner) {
      return NextResponse.json({ error: 'address and owner are required' }, { status: 400 });
    }

    // Always slugify, even a client-supplied slug, so it can't carry path
    // traversal (e.g. "../../etc") into createPropertyFolder's filesystem path.
    const slug = slugifyAddress(body.slug || address);

    await createPropertyFolder(slug, { address, owner, contact: contact || '', listed: listed || '', priceGuide: priceGuide || 'TBC', campaignType: campaignType || 'Private Sale' });

    const token = assignToken(slug, { ownerName: owner, ownerEmail: contact });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const portalUrl = `${baseUrl}/vendor/${token}`;

    // Send welcome email directly via the shared helper — never loop back
    // over HTTP to the now token-only /api/vendor/notify route.
    if (contact && contact.includes('@')) {
      try {
        const html = renderVendorEmail({ ownerName: owner, address, portalUrl });
        await sendEmail({ to: contact, subject: `Your vendor portal is ready — ${address}`, html });
      } catch {
        // Non-fatal — email failure shouldn't block property creation
      }
    }

    return NextResponse.json({ slug, token, portalUrl }, { status: 201 });
  } catch (err) {
    console.error('Property creation failed:', err);
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}
