import { readOpens } from '@/lib/markdown-loader';
import { readBuyers } from '@/lib/buyers';
import { readOffers } from '@/lib/offers';
import { readCompetitorSnapshots } from '@/lib/competitors';
import { callMiniMax } from '@/lib/minimax';
import type { WeeklyDraft } from '@/lib/types';

// Removes phone numbers and email addresses from free-text before it is
// passed to the model (R9/security: buyer feedback notes must never leak a
// contact detail into a third-party AI call).
export function scrubContact(text: string): string {
  return text
    .replace(/\b0\d[\d ]{7,10}\d\b/g, '[phone removed]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email removed]');
}

export interface WeekSummary {
  address: string;
  weekEnding: string;
  stats: { source: string; views: number; enquiries: number; viewsDelta: number; enquiriesDelta: number }[];
  groupsThisWeek: number;
  newBuyers: { position: string; interest: string; feedback?: string }[];
  offers: { amount: number; status: string }[];
  competitorChanges: number;
  upcomingOpens: number;
}

// Gathers the structured facts the narrative is drafted from — stats
// deltas, opens/groups, buyer feedback themes (scrubbed), offers, competitor
// changes — so the model never sees raw buyer contact fields (U8).
export async function buildWeekSummary(draft: WeeklyDraft): Promise<WeekSummary> {
  const slug = draft.propertySlug;
  const [opens, buyers, offers, snapshots] = await Promise.all([
    readOpens(slug), readBuyers(slug), readOffers(slug), readCompetitorSnapshots(slug),
  ]);

  const weekStart = new Date(new Date(draft.weekEnding).getTime() - 6 * 24 * 60 * 60 * 1000);
  const groupsThisWeek = opens
    .filter(o => new Date(o.start) >= weekStart && new Date(o.start) <= new Date(draft.weekEnding))
    .reduce((sum, o) => sum + (o.attendance?.checkins.length ?? 0), 0);

  const recentBuyers = buyers.filter(b => new Date(b.created) >= weekStart && !b.private);
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];
  const competitorChanges = latest && previous
    ? Math.abs(latest.listings.length - previous.listings.length)
    : 0;

  return {
    address: draft.propertyAddress,
    weekEnding: draft.weekEnding,
    stats: [
      { source: 'REA', views: draft.reaViews, enquiries: draft.reaEnquiries, viewsDelta: 0, enquiriesDelta: 0 },
      { source: 'Domain', views: draft.domainViews, enquiries: draft.domainEnquiries, viewsDelta: 0, enquiriesDelta: 0 },
    ],
    groupsThisWeek,
    newBuyers: recentBuyers.map(b => ({
      position: b.position,
      interest: b.interest,
      feedback: b.feedback[b.feedback.length - 1] ? scrubContact(b.feedback[b.feedback.length - 1].note) : undefined,
    })),
    offers: offers.filter(o => new Date(o.created) >= weekStart).map(o => ({ amount: o.amount, status: o.status })),
    competitorChanges,
    upcomingOpens: opens.filter(o => new Date(o.start) > new Date()).length,
  };
}

// Drafts 120-180 words of agent commentary from the structured summary,
// seeded with the current Latest Update text for voice continuity. Never
// invents figures beyond what the summary states (U8).
export async function draftNarrative(summary: WeekSummary, seedText: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not configured');

  const prompt = `You are a Melbourne real estate agent at Grant Estate Agency writing your weekly update to a vendor about their campaign.

Write 120-180 words in first person, Australian English, in the voice of this previous update (match tone, not content):
"""
${seedText || '(no previous update — write in a warm, direct, professional voice)'}
"""

Use ONLY these facts — do not invent figures:
- Address: ${summary.address}, week ending ${summary.weekEnding}
- Portal stats: ${summary.stats.map(s => `${s.source} ${s.views} views, ${s.enquiries} enquiries`).join('; ')}
- Groups through this week: ${summary.groupsThisWeek}
- New buyer interest: ${summary.newBuyers.map(b => `${b.position} (${b.interest})${b.feedback ? `: "${b.feedback}"` : ''}`).join('; ') || 'none new this week'}
- Offers this week: ${summary.offers.map(o => `$${o.amount.toLocaleString('en-AU')} (${o.status})`).join('; ') || 'none'}
- Competing listings changed by: ${summary.competitorChanges}
- Upcoming opens scheduled: ${summary.upcomingOpens}

End with the one thing the vendor should decide or know this week. Return only the update text — no preamble, no labels, no quotes.`;

  const text = await callMiniMax(apiKey, [{ role: 'user', content: prompt }], { temperature: 0.7, max_tokens: 500 });
  return text.trim();
}
