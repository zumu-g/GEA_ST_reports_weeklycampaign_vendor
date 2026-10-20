import { NextRequest, NextResponse } from 'next/server';
import { resolveVendorToken } from '@/lib/vendor-tokens';
import { authorised } from '@/lib/agent-auth';
import { sendEmail, renderVendorEmail } from '@/lib/notify-email';
import { recordSentReportDelivery } from '@/lib/sent-report-sync';
import { getProperty } from '@/lib/markdown-loader';

// POST /api/vendor/notify — send an update email to the vendor who owns `token`.
// Body: { token, message?, weekEnding? }
// Resolves the recipient from the token's own stored meta (never the body),
// and requires an agent key or admin session so a leaked token cannot be used
// to send arbitrary trusted-sender email to the vendor it belongs to.
export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
  }

  try {
    const { token, message, weekEnding } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const resolved = resolveVendorToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }
    const { slug, meta } = resolved;
    if (!meta.ownerEmail) {
      return NextResponse.json({ error: 'No owner email on file for this token' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const portalUrl = `${baseUrl}/vendor/${token}`;
    const property = await getProperty(slug);
    const address = property?.address || slug;

    const html = renderVendorEmail({ ownerName: meta.ownerName, address, portalUrl, message });
    const result = await sendEmail({
      to: meta.ownerEmail,
      subject: message ? `Update on your campaign — ${address}` : `Your vendor portal is ready — ${address}`,
      html,
    });

    if (!result.sent) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    if (weekEnding) {
      await recordSentReportDelivery({
        address,
        weekEnding,
        recipientName: meta.ownerName ?? null,
        recipientEmail: meta.ownerEmail ?? null,
        channel: 'email',
        portalPath: new URL(portalUrl).pathname,
      });
    }

    return NextResponse.json({ sent: true, id: result.id });
  } catch (err) {
    console.error('Notify failed:', err);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
