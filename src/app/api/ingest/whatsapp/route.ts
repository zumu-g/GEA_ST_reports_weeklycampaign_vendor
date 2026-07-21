import { NextRequest, NextResponse } from 'next/server';
import { resolveProperty } from '@/lib/property-registry';
import { writeInspectionFile, appendActivity } from '@/lib/markdown-loader';
import { parseFreeformNote, parseTelegramMessage } from '@/lib/message-parsers';
import { verifyTwilioSignature, signedUrlForPath } from '@/lib/twilio-signature';

export const runtime = 'nodejs';

// A fresh Response per call — a shared module-level instance would have its
// body stream consumed (and error) after the first request.
function emptyTwiml(): NextResponse {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

// A WhatsApp business number is public (it'll be on signage/listings), unlike
// a Telegram bot only the agent/vendor know the handle for. Twilio's
// signature proves the request came from Twilio — it says nothing about who
// sent the message — so senders must also be allowlisted.
//
// Twilio's `From` for a WhatsApp message is always channel-prefixed, e.g.
// "whatsapp:+61400000000" — strip it so WHATSAPP_ALLOWED_SENDERS can be
// configured as plain E.164 numbers.
function stripWhatsappPrefix(from: string): string {
  return from.replace(/^whatsapp:/i, '');
}

function isAllowedSender(from: string): boolean {
  const allowed = (process.env.WHATSAPP_ALLOWED_SENDERS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return allowed.includes(stripWhatsappPrefix(from));
}

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'WhatsApp ingest not configured' }, { status: 503 });
    }
    // dev-mode: fall through unauthenticated, matching ingestAuth's posture
  }

  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  if (authToken) {
    const signature = request.headers.get('x-twilio-signature');
    const signedUrl = signedUrlForPath('/api/ingest/whatsapp');
    if (!verifyTwilioSignature(authToken, signature, signedUrl, params)) {
      return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 });
    }
  }

  const from = stripWhatsappPrefix(params.From || '');
  if (!isAllowedSender(params.From || '')) {
    return emptyTwiml();
  }

  const message = params.Body || '';
  if (!message) {
    return emptyTwiml();
  }

  const note = parseFreeformNote(message);
  if (note) {
    const property = resolveProperty(note.propertyText);
    if (!property) return emptyTwiml();
    await appendActivity(property.slug, {
      source: 'whatsapp',
      actor: from || 'WhatsApp',
      summary: note.note,
    });
    return emptyTwiml();
  }

  const parsed = parseTelegramMessage(message);
  if (!parsed) return emptyTwiml();

  const property = resolveProperty(parsed.propertyText);
  if (!property) return emptyTwiml();

  const today = new Date().toISOString().split('T')[0];
  await writeInspectionFile(property.slug, {
    date: today,
    type: parsed.type,
    groups: parsed.groups,
    interested: parsed.interested,
    interestLevel: parsed.interestLevel,
    notes: parsed.notes,
  });

  return emptyTwiml();
}
