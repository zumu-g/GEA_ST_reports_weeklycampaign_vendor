import { NextRequest, NextResponse } from 'next/server';
import { authorised } from '@/lib/agent-auth';
import { dispatchNotifications } from '@/lib/dispatch-notifications';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Triggered by Railway's cron (or an in-process interval) every 5 minutes.
// Runs in the same web service that owns the properties volume, since a
// Railway volume can't be shared with a separate cron service.
// ponytail: dispatchNotifications() processes queued items sequentially
// (matching the Python original it's ported from); at ~5min cadence this
// keeps well under maxDuration=30s for realistic queue sizes. If the queue
// regularly backs up past what 30s can drain, parallelize with
// Promise.allSettled in dispatch-notifications.ts.
export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const result = await dispatchNotifications();
  return NextResponse.json(result);
}
