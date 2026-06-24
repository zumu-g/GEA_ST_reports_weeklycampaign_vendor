import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { recordSentReportDelivery } from '@/lib/sent-report-sync';

// POST /api/vendor/notify — send welcome or update email to a vendor
// Body: { token, ownerName, ownerEmail, address, portalUrl, message?, weekEnding? }
// When `weekEnding` is present the email is a weekly-report send, so the CRM
// sent-report record is stamped `sent` (best-effort); welcome emails omit it.
export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
  }

  try {
    const { ownerName, ownerEmail, address, portalUrl, message, weekEnding } = await request.json();

    if (!ownerEmail || !portalUrl) {
      return NextResponse.json({ error: 'ownerEmail and portalUrl are required' }, { status: 400 });
    }

    const resend = new Resend(apiKey);
    const fromAddress = process.env.RESEND_FROM || 'Grant Estate Agency <portal@grantsea.com.au>';
    const firstName = ownerName?.split(' ')[0] || 'there';

    const bodyText = message
      ? `<p style="font-size:15px;line-height:1.6;color:#1A1814;">${message}</p>`
      : `<p style="font-size:15px;line-height:1.6;color:#1A1814;">Your personalised campaign dashboard is ready. You can view live analytics, inspection results, and communications from your agent at any time.</p>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:'DM Sans',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #E0DBD4;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#1A1814;padding:24px 32px;">
            <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#C8A96E;">Grant Estate Agency</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:500;color:#1A1814;font-family:Georgia,serif;">Hi ${firstName},</h1>
            <p style="margin:0 0 20px;font-size:13px;color:#8B8580;">${address}</p>
            ${bodyText}
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:#1A1814;border-radius:8px;padding:14px 28px;">
                  <a href="${portalUrl}" style="color:#C8A96E;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.04em;">View Your Campaign Dashboard →</a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;color:#8B8580;line-height:1.6;">Or copy this link into your browser:<br>
              <a href="${portalUrl}" style="color:#1A1814;word-break:break-all;">${portalUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #E0DBD4;">
            <p style="margin:0;font-size:12px;color:#8B8580;">Grant Estate Agency · Private &amp; Confidential · This link is unique to you.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: ownerEmail,
      subject: message ? `Update on your campaign — ${address}` : `Your vendor portal is ready — ${address}`,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Weekly-report send → stamp the CRM sent-report `sent` (best-effort,
    // never blocks the email response). Welcome emails omit weekEnding.
    if (weekEnding && address) {
      await recordSentReportDelivery({
        address,
        weekEnding,
        recipientName: ownerName ?? null,
        recipientEmail: ownerEmail ?? null,
        channel: 'email',
        portalPath: portalUrl ? new URL(portalUrl).pathname : null,
      });
    }

    return NextResponse.json({ sent: true, id: data?.id });
  } catch (err) {
    console.error('Notify failed:', err);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
