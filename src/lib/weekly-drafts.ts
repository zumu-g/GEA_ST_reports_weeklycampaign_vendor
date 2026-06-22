import fs from 'fs/promises';
import path from 'path';
import { WeeklyDraft } from '@/lib/types';
import { getAllProperties, getProperty } from '@/lib/markdown-loader';
import { propertyToVendorReport } from '@/lib/data-adapter';
import { resolveListing, getReportListing } from '@/lib/crm-client';
import { applyCrmToDraft } from '@/lib/crm-draft-mapper';

const PROPERTIES_DIR =
  process.env.PROPERTIES_DIR ||
  '/Users/stuartgrant_mbp13/Library/Mobile Documents/com~apple~CloudDocs/GEA_vendor_portal/properties';

export function makeWeeklyDraftId(slug: string, weekEnding: string): string {
  return `${slug}--${weekEnding}`;
}

export function parseWeeklyDraftId(id: string): { slug: string; weekEnding: string } | null {
  const separatorIndex = id.lastIndexOf('--');
  if (separatorIndex === -1) return null;
  const slug = id.slice(0, separatorIndex);
  const weekEnding = id.slice(separatorIndex + 2);
  if (!slug || !weekEnding) return null;
  return { slug, weekEnding };
}

function getDraftPath(slug: string, weekEnding: string): string {
  return path.join(PROPERTIES_DIR, slug, 'weekly', `${weekEnding}.json`);
}

export async function getWeeklyDraft(slug: string, weekEnding: string): Promise<WeeklyDraft | null> {
  try {
    const content = await fs.readFile(getDraftPath(slug, weekEnding), 'utf-8');
    return JSON.parse(content) as WeeklyDraft;
  } catch {
    return null;
  }
}

export async function saveWeeklyDraft(draft: WeeklyDraft): Promise<void> {
  const filePath = getDraftPath(draft.propertySlug, draft.weekEnding);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(draft, null, 2), 'utf-8');
}

export async function getAllWeeklyDrafts(weekEnding: string): Promise<WeeklyDraft[]> {
  try {
    const properties = await getAllProperties();
    const drafts = await Promise.all(properties.map((p) => getWeeklyDraft(p.slug, weekEnding)));
    return drafts.filter((d): d is WeeklyDraft => d !== null);
  } catch {
    return [];
  }
}

export async function generateWeeklyDraftForProperty(
  slug: string,
  weekEnding: string
): Promise<WeeklyDraft> {
  const property = await getProperty(slug);
  if (!property) throw new Error(`Property not found: ${slug}`);

  const report = propertyToVendorReport(property);

  const base: WeeklyDraft = {
    id: makeWeeklyDraftId(slug, weekEnding),
    propertySlug: slug,
    weekEnding,
    status: 'draft',
    approvedAt: null,
    propertyAddress: report.propertyAddress,
    vendorName: report.vendorName,
    agent: report.agent,
    askingPrice: report.askingPrice,
    campaignType: report.campaignType,
    listingDate: report.listingDate,
    daysOnMarket: report.daysOnMarket,
    reaViews: report.reaViews,
    reaEnquiries: report.reaEnquiries,
    reaSaves: report.reaSaves,
    reaSearchAppearances: report.reaSearchAppearances,
    domainViews: report.domainViews,
    domainEnquiries: report.domainEnquiries,
    domainSaves: report.domainSaves,
    domainSearchAppearances: report.domainSearchAppearances,
    openHomeAttendees: report.openHomeAttendees,
    privateInspections: report.privateInspections,
    agentCommentary: '',
    newsArticles: [],
    generatedNarrative: null,
    messages: [],
    fieldSources: {},
    agentEdited: [],
  };

  return enrichDraftFromCrm(base);
}

/**
 * Pre-fill a draft from the CRM read API. Resolves the listing by address, fetches
 * its property + gap-aware stats, and applies them without clobbering agent edits.
 * Degrades gracefully: an unresolved listing or unreachable CRM marks fields as
 * gaps rather than failing (plan KTD5/KTD6).
 */
export async function enrichDraftFromCrm(draft: WeeklyDraft): Promise<WeeklyDraft> {
  const resolved = await resolveListing({ address: draft.propertyAddress });
  if (!resolved.ok || !resolved.data) return applyCrmToDraft(draft, null);

  const listing = await getReportListing(resolved.data.listingId);
  if (!listing.ok || !listing.data) return applyCrmToDraft(draft, null);

  return applyCrmToDraft(draft, listing.data);
}

export async function generateAllWeeklyDrafts(
  weekEnding: string
): Promise<{ created: number; skipped: number; drafts: WeeklyDraft[] }> {
  const properties = await getAllProperties();
  const results: WeeklyDraft[] = [];
  let created = 0;
  let skipped = 0;

  for (const property of properties) {
    const existing = await getWeeklyDraft(property.slug, weekEnding);
    if (existing) {
      skipped++;
      results.push(existing);
      continue;
    }
    const draft = await generateWeeklyDraftForProperty(property.slug, weekEnding);
    await saveWeeklyDraft(draft);
    results.push(draft);
    created++;
  }

  return { created, skipped, drafts: results };
}

export async function approveWeeklyDraft(
  slug: string,
  weekEnding: string
): Promise<WeeklyDraft | null> {
  const draft = await getWeeklyDraft(slug, weekEnding);
  if (!draft) return null;

  const approved: WeeklyDraft = {
    ...draft,
    status: 'approved',
    approvedAt: new Date().toISOString(),
  };

  await saveWeeklyDraft(approved);
  return approved;
}

export function getComingWeekEnding(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const daysToSunday = day === 0 ? 0 : 7 - day;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysToSunday);
  return sunday.toISOString().split('T')[0];
}
