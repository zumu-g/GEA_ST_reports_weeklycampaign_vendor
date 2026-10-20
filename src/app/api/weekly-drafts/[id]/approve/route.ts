import { NextRequest, NextResponse } from 'next/server';
import { parseWeeklyDraftId, approveWeeklyDraft } from '@/lib/weekly-drafts';
import { getTokenForSlug } from '@/lib/vendor-tokens';
import { recordApprovedReport } from '@/lib/sent-report-sync';
import { appendMarketNews, writeAnalyticsFile, writeLatestUpdate, updatePropertySection, appendActivity, enqueueNotification, getProperty } from '@/lib/markdown-loader';
import type { WeeklyDraft } from '@/lib/types';

// Sync the approved week's portal stats into the property's analytics markdown
// — the surface the vendor portal actually renders from (same U5 finding as
// newsArticles: the draft JSON alone never reaches the portal). Gap-aware: a
// source is written only when it has at least one real (non-gap) capture or an
// agent-entered non-zero value — never zero-filled from pure gaps.
async function syncDraftAnalytics(draft: WeeklyDraft): Promise<void> {
  const sources = [
    {
      source: 'rea',
      views: draft.reaViews,
      enquiries: draft.reaEnquiries,
      saves: draft.reaSaves,
      searchAppearances: draft.reaSearchAppearances,
      fields: ['reaViews', 'reaEnquiries', 'reaSaves', 'reaSearchAppearances'],
    },
    {
      source: 'domain',
      views: draft.domainViews,
      enquiries: draft.domainEnquiries,
      saves: draft.domainSaves,
      searchAppearances: draft.domainSearchAppearances,
      fields: ['domainViews', 'domainEnquiries', 'domainSaves', 'domainSearchAppearances'],
    },
  ];
  for (const s of sources) {
    const hasRealCapture = s.fields.some((f) => draft.fieldSources?.[f]?.gap === false);
    const hasValue = s.views > 0 || s.enquiries > 0 || s.saves > 0;
    if (!hasRealCapture && !hasValue) continue;
    await writeAnalyticsFile(draft.propertySlug, {
      source: s.source,
      weekEnding: draft.weekEnding,
      views: s.views,
      enquiries: s.enquiries,
      saves: s.saves,
      searchAppearances: s.searchAppearances,
    });
  }
}

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

  // Sync the week's stats into analytics markdown so the portal renders them.
  await syncDraftAnalytics(draft);

  // Publish the agent-drafted/edited narrative as the vendor's "From Your
  // Agent" update (U8/R9) — only on this explicit approve action, never as
  // a side effect of drafting.
  if (draft.agentCommentary) {
    await writeLatestUpdate(draft.propertySlug, draft.agentCommentary);
    const property = await getProperty(draft.propertySlug);
    const existingComms = property?.communications ?? [];
    await updatePropertySection(
      draft.propertySlug,
      'Communications Log',
      '| Date | Type | Summary |',
      [...existingComms.map(c => [c.date, c.type, c.summary]), [draft.weekEnding, 'Weekly Update', draft.agentCommentary.slice(0, 140)]],
    );
    await appendActivity(draft.propertySlug, {
      source: 'comment',
      actor: 'Agent',
      summary: `Weekly update published: ${draft.agentCommentary.slice(0, 100)}`,
    });
    const token = getTokenForSlug(draft.propertySlug);
    // Push-only: the push dispatcher resolves subscriptions from the slug
    // alone (push.json), unlike email/SMS which need a `to` address.
    await enqueueNotification({
      channel: 'push',
      to: {},
      slug: draft.propertySlug,
      subject: 'Your weekly update is ready',
      body: draft.agentCommentary.slice(0, 200),
      portalUrl: token ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/vendor/${token}` : undefined,
      notificationType: 'Weekly Report',
    });
  }

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
