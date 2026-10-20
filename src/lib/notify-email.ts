import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  sent: boolean;
  id?: string;
  error?: string;
}

// Shared Resend sender used by the vendor notify route and by internal
// server-side callers (properties/create welcome email, the agent-comment
// alert) that must never loop back over HTTP to a hardened, token-only route.
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY not configured' };

  const resend = new Resend(apiKey);
  const fromAddress = process.env.RESEND_FROM || 'Grant Estate Agency <portal@grantsea.com.au>';

  const { data, error } = await resend.emails.send({ from: fromAddress, to, subject, html });
  if (error) return { sent: false, error: error.message };
  return { sent: true, id: data?.id };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderVendorEmail({
  ownerName,
  address,
  portalUrl,
  message,
}: {
  ownerName?: string;
  address: string;
  portalUrl: string;
  message?: string;
}): string {
  const firstName = escapeHtml(ownerName?.split(' ')[0] || 'there');
  const safeAddress = escapeHtml(address);
  const safePortalUrl = escapeHtml(portalUrl);
  const bodyText = message
    ? `<p style="font-size:15px;line-height:1.6;color:#1A1814;">${escapeHtml(message)}</p>`
    : `<p style="font-size:15px;line-height:1.6;color:#1A1814;">Your personalised campaign dashboard is ready. You can view live analytics, inspection results, and communications from your agent at any time.</p>`;

  return `<!DOCTYPE html>
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
            <p style="margin:0 0 20px;font-size:13px;color:#8B8580;">${safeAddress}</p>
            ${bodyText}
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:#1A1814;border-radius:8px;padding:14px 28px;">
                  <a href="${safePortalUrl}" style="color:#C8A96E;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.04em;">View Your Campaign Dashboard →</a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;color:#8B8580;line-height:1.6;">Or copy this link into your browser:<br>
              <a href="${safePortalUrl}" style="color:#1A1814;word-break:break-all;">${safePortalUrl}</a>
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
}
