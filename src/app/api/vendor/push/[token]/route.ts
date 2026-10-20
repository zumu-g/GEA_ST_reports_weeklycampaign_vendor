import { NextRequest, NextResponse } from 'next/server';
import { resolveVendorToken } from '@/lib/vendor-tokens';
import { savePushSubscription, removePushSubscription } from '@/lib/push';

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
  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'endpoint and keys.p256dh/keys.auth are required' }, { status: 400 });
  }

  await savePushSubscription(resolved.slug, { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resolved = resolveVendorToken(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body.endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
  }
  await removePushSubscription(resolved.slug, body.endpoint);
  return NextResponse.json({ success: true });
}
