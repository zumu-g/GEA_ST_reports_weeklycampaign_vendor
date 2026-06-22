// Server-side client for the GEA_crmAI weekly-report read API.
//
// Two endpoints (see GEA_crmAI src/app/api/report/*):
//   GET /api/report/resolve?vaultId=|address=  -> { listingId, vaultExternalId }
//   GET /api/report/listings/{id}              -> { listing, stats, statsByPortal }
//
// Auth: Authorization: Bearer <WEEKLY_REPORT_API_TOKEN>. This module is
// server-only — the token must never reach the browser bundle. All calls return
// a typed CrmResult and never throw to the caller, so draft generation can
// degrade gracefully (gap fields) when the CRM is unreachable or unconfigured.

const CRM_API_BASE_URL = process.env.CRM_API_BASE_URL;
const WEEKLY_REPORT_API_TOKEN = process.env.WEEKLY_REPORT_API_TOKEN;
const DEFAULT_TIMEOUT_MS = 8000;

/** Provenance + freshness for one metric, mirroring the CRM contract. */
export interface CrmStat {
  value: number | null;
  source: string | null;
  capturedAt: string | null;
  gap: boolean;
}

export interface CrmListing {
  id: string;
  vaultExternalId: string | null;
  type: string | null;
  propertyAddress: string;
  suburb: string | null;
  postcode: string | null;
  state: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  carSpaces: number | null;
  price: number | null;
  priceGuide: string | null;
  listedDate: string | null;
  daysOnMarket: number | null;
  agentName: string | null;
  vendorName: string | null;
  soldPrice: number | null;
  soldDate: string | null;
  ownerContactId: string | null;
}

export interface ResolvedListing {
  listingId: string;
  vaultExternalId: string | null;
}

export interface ReportListing {
  listing: CrmListing;
  /** Latest capture per metric across all sources. */
  stats: Record<string, CrmStat>;
  /** Same shape split by source, e.g. { rea: {...}, domain: {...} }. */
  statsByPortal: Record<string, Record<string, CrmStat>>;
}

export type CrmResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

/** True when both base URL and token are configured. */
export function isCrmConfigured(): boolean {
  return Boolean(CRM_API_BASE_URL && WEEKLY_REPORT_API_TOKEN);
}

async function crmFetch<T>(pathAndQuery: string): Promise<CrmResult<T | null>> {
  if (!isCrmConfigured()) {
    return { ok: false, error: 'CRM not configured (CRM_API_BASE_URL / WEEKLY_REPORT_API_TOKEN)' };
  }

  const url = `${CRM_API_BASE_URL!.replace(/\/$/, '')}${pathAndQuery}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${WEEKLY_REPORT_API_TOKEN}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    // 404 is a legitimate "no match / not found" — surface as data: null, not error.
    if (res.status === 404) return { ok: true, data: null };

    if (!res.ok) {
      return { ok: false, error: `CRM API error ${res.status}`, status: res.status };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `CRM request failed: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a CRM listingId from a VaultRE id or address.
 * Returns data: null when the CRM has no match (404).
 */
export async function resolveListing(params: {
  vaultId?: string | null;
  address?: string | null;
}): Promise<CrmResult<ResolvedListing | null>> {
  const qs = new URLSearchParams();
  if (params.vaultId) qs.set('vaultId', params.vaultId);
  if (params.address) qs.set('address', params.address);
  if ([...qs.keys()].length === 0) {
    return { ok: false, error: 'resolveListing requires vaultId or address' };
  }
  return crmFetch<ResolvedListing>(`/api/report/resolve?${qs.toString()}`);
}

/**
 * Fetch property + gap-aware stats for a resolved listingId.
 * Returns data: null when the listing is not found (404).
 */
export async function getReportListing(
  listingId: string,
): Promise<CrmResult<ReportListing | null>> {
  return crmFetch<ReportListing>(`/api/report/listings/${encodeURIComponent(listingId)}`);
}
