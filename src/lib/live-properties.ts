// Reconciles the GEA CRM's live listing set with local property markdown
// folders (plan: docs/plans/2026-07-23-001-fix-portal-live-crm-listings-plan.md).
//
// Every portal consumer (dashboard, weekly drafts, article broadcasts,
// Telegram/WhatsApp property resolution, vendor portal pages) should show
// exactly the CRM's live listings — not "whatever folders happen to exist."
// This module is the single place that reconciliation happens; callers get
// back a resolved set plus provenance (crm vs markdown-fallback) so they can
// react to a CRM outage explicitly instead of silently rendering stale data.
import type { CrmListing, ReportListing } from '@/lib/crm-client';
import { isCrmConfigured, listAllListings } from '@/lib/crm-client';
import {
  getAllProperties,
  getProperty,
  createPropertyFolder,
  setCrmListingId,
  slugifyAddress,
  type PropertyData,
} from '@/lib/markdown-loader';

export interface LiveProperty {
  slug: string;
  /** Full CRM report entry (listing + gap-aware stats) — consumers building a
   *  VendorReport should read this rather than re-fetching per listing. */
  report: ReportListing;
  property: PropertyData | null;
}

export interface LivePropertySetResult {
  /** Live properties, CRM-matched to a folder (auto-created if none existed). */
  properties: LiveProperty[];
  source: 'crm' | 'markdown-fallback';
  crmError?: string;
  /** All local folder slugs, for consumers that need to know what's being hidden. */
  allSlugs: string[];
  /** Slugs excluded because their listing isn't in the CRM live set (source: 'crm' only). */
  hiddenSlugs: string[];
  /** CRM listings that couldn't be matched or auto-created (address collision, malformed address). */
  conflicts: { listing: CrmListing; reason: string }[];
}

// Lowercase, strip state/postcode/punctuation, collapse whitespace — so
// "85 Centenary Boulevard, Officer South VIC 3809" and "85 centenary blvd,
// officer south" compare equal. Deliberately loose: false positives are
// caught by keeping full listing data on the match, false negatives just
// fall through to auto-create (safe default).
const STATE_CODES = /\b(vic|nsw|qld|sa|wa|tas|nt|act)\b/gi;

// The CRM's propertyAddress field is sometimes just the street line (e.g.
// "17 Juliet Gardens") with suburb/state/postcode carried in separate DTO
// fields rather than folded into the string — matching or slugifying on
// propertyAddress alone then misses folders titled "...Suburb VIC ####" and
// creates a duplicate. Compose the full address whenever those fields exist.
export function fullAddress(listing: CrmListing): string {
  const parts = [listing.propertyAddress];
  const locality = [listing.suburb, listing.state, listing.postcode].filter(Boolean).join(' ');
  if (locality) parts.push(locality);
  return parts.join(', ');
}

export function normaliseAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(STATE_CODES, ' ')
    .replace(/\d{4}\b/g, ' ') // postcode
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bblvd\b/g, 'boulevard')
    .replace(/\bdr\b/g, 'drive')
    .replace(/\bct\b/g, 'court')
    .replace(/\bst\b/g, 'street')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getLivePropertySet(): Promise<LivePropertySetResult> {
  const allProperties = await getAllProperties();
  const allSlugs = allProperties.map((p) => p.slug);

  if (!isCrmConfigured()) {
    return {
      properties: [],
      source: 'markdown-fallback',
      crmError: 'CRM not configured (CRM_API_BASE_URL / WEEKLY_REPORT_API_TOKEN)',
      allSlugs,
      hiddenSlugs: [],
      conflicts: [],
    };
  }

  const crm = await listAllListings();
  if (!crm.ok) {
    return {
      properties: [],
      source: 'markdown-fallback',
      crmError: crm.error,
      allSlugs,
      hiddenSlugs: [],
      conflicts: [],
    };
  }

  const byId = new Map(allProperties.map((p) => [p.crmListingId, p]));
  const byAddress = new Map(allProperties.map((p) => [normaliseAddress(p.address), p]));
  const matchedSlugs = new Set<string>();
  const conflicts: { listing: CrmListing; reason: string }[] = [];
  const properties: LiveProperty[] = [];

  for (const report of crm.data) {
    const listing = report.listing;
    // 1. Match by stored CRM listing id (stable across address-format drift).
    let property = listing.id ? byId.get(listing.id) ?? null : null;

    // 2. Fall back to normalised-address match; write the id back so future
    // runs use the stable id (KTD2/R5).
    if (!property) {
      const normalised = normaliseAddress(fullAddress(listing));
      const addressMatch = byAddress.get(normalised) ?? null;
      if (addressMatch) {
        property = addressMatch;
        await setCrmListingId(addressMatch.slug, listing.id);
      }
    }

    // 3. No folder at all — auto-create one from the template (KTD3/R2).
    if (!property) {
      const composedAddress = fullAddress(listing);
      // Repo slug convention is street-suburb only, no state/postcode
      // (CLAUDE.md) — CRM addresses carry both, so strip them before slugifying.
      const slug = slugifyAddress(composedAddress.replace(STATE_CODES, '').replace(/\d{4}\b/g, ''));
      if (!slug) {
        conflicts.push({ listing, reason: 'Listing has no usable address to derive a slug from' });
        continue;
      }
      if (allSlugs.includes(slug)) {
        // Slug collides with an existing (non-matching) folder — refuse to
        // overwrite; surface as a conflict rather than guessing.
        conflicts.push({ listing, reason: `Slug "${slug}" already exists but did not match by id or address` });
        continue;
      }
      try {
        await createPropertyFolder(slug, {
          address: composedAddress,
          owner: listing.vendorName ?? 'TBC',
          contact: '',
          listed: listing.listedDate ?? '',
          priceGuide: listing.priceGuide ?? 'TBC',
          campaignType: listing.type ?? 'Private Sale',
          crmListingId: listing.id,
        });
        matchedSlugs.add(slug);
        properties.push({ slug, report, property: await getProperty(slug) });
      } catch (err) {
        conflicts.push({
          listing,
          reason: `Folder creation failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      continue;
    }

    matchedSlugs.add(property.slug);
    properties.push({ slug: property.slug, report, property });
  }

  const hiddenSlugs = allSlugs.filter((slug) => !matchedSlugs.has(slug));

  return { properties, source: 'crm', allSlugs, hiddenSlugs, conflicts };
}

/**
 * The vendor portal's hide/show decision (U4), extracted as a pure predicate
 * so it's testable without rendering the page: hide only when the CRM
 * actively confirms the slug isn't live. A CRM outage (source:
 * 'markdown-fallback') always fails open — KTD4.
 */
export function isHiddenFromPortal(slug: string, live: { slugs: string[]; source: 'crm' | 'markdown-fallback' }): boolean {
  return live.source === 'crm' && !live.slugs.includes(slug);
}

/** Convenience: just the slugs the rest of the app should treat as active. */
export async function getLivePropertySlugs(): Promise<{ slugs: string[]; source: 'crm' | 'markdown-fallback'; crmError?: string }> {
  const result = await getLivePropertySet();
  if (result.source === 'markdown-fallback') {
    return { slugs: result.allSlugs, source: 'markdown-fallback', crmError: result.crmError };
  }
  return { slugs: result.properties.map((p) => p.slug), source: 'crm' };
}

/**
 * Convenience for consumers (weekly draft generation, article broadcast, the
 * generate-report picker) that just need the live PropertyData[] set — CRM
 * mode filters to live folders; markdown-fallback mode returns everything
 * (KTD4: fail open, never hide on a CRM outage).
 */
export async function getLivePropertyData(): Promise<{
  properties: PropertyData[];
  source: 'crm' | 'markdown-fallback';
  crmError?: string;
}> {
  const result = await getLivePropertySet();
  if (result.source === 'markdown-fallback') {
    const all = await getAllProperties();
    return { properties: all, source: 'markdown-fallback', crmError: result.crmError };
  }
  const properties = result.properties
    .map((lp) => lp.property)
    .filter((p): p is PropertyData => p !== null);
  return { properties, source: 'crm' };
}
