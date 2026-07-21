import { NextRequest, NextResponse } from 'next/server';
import { parseWeeklyDraftId, approveWeeklyDraft } from '@/lib/weekly-drafts';
import { getTokenForSlug } from '@/lib/vendor-tokens';
import { recordApprovedReport } from '@/lib/sent-report-sync';
import { appendMarketNews } from '@/lib/markdown-loader';

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = parseWeeklyDraftId(id);
  if (!parsed) return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 });

  const draft = await approveWeeklyDraft(parsed.slug, parsed.weekEnding);
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  // Sync newsArticles (including broadcast articles) into the property
  // markdown that the vendor portal actually renders from — the draft JSON
  // alone never reaches the portal (U5 finding).
  await appendMarketNews(draft.propertySlug, draft.newsArticles);

  // Record an `approved` sent-report in the CRM — best-effort, never blocks
  // approval (KTD4). Listing resolved by address CRM-side.
  const token = getTokenForSlug(draft.propertySlug);
  await recordApprovedReport({
    address: draft.propertyAddress,
    weekEnding: draft.weekEnding,
    approvedBy: draft.agent,
    approvedAt: draft.approvedAt,
    portalPath: token ? `/vendor/${token}` : null,
  });

  return NextResponse.json(draft);
}
