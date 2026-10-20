import { NextRequest, NextResponse } from 'next/server';
import { resolveVendorToken } from '@/lib/vendor-tokens';
import { readOpens, readActivity, getLiveStats } from '@/lib/markdown-loader';
import { readBuyers } from '@/lib/buyers';

// GET — the one polled endpoint LiveRefresh.tsx calls to decide whether to
// re-render the vendor page. Deliberately small and cheap: it tells the
// client *that* something changed, not *what*, so the page re-fetch (a
// normal server render) stays the single source of truth (KTD4).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const resolved = resolveVendorToken(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }
  const { slug } = resolved;

  const [opens, activity, stats, buyers] = await Promise.all([
    readOpens(slug),
    readActivity(slug),
    getLiveStats(slug),
    readBuyers(slug),
  ]);

  const openInProgress = opens.some(o => o.attendance?.status === 'open');
  const groupsNow = opens
    .filter(o => o.attendance?.status === 'open')
    .reduce((sum, o) => sum + (o.attendance?.checkins.length ?? 0), 0);
  const lastActivityId = activity[activity.length - 1]?.id ?? null;

  return NextResponse.json({
    openInProgress,
    groupsNow,
    lastActivityId,
    buyerCount: buyers.filter(b => !b.private).length,
    statsCapturedAt: stats?.asAt ?? null,
  });
}
