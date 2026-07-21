/**
 * Thin server-side client for the everypropertyAI vendor-report endpoint.
 *
 * One call returns, for a subject property, the 3 CLOSEST sold sales and the
 * 3 NEWEST on-market listings within a radius (default 500m). The endpoint
 * geocodes a free-text `address` itself when lat/lng aren't supplied.
 *
 * Server-only: the Bearer key must never reach the browser. Always call this
 * from a server context (our /api/local-market route), never from a component.
 *
 * Endpoint: GET {EVERYPROPERTY_API_URL}/api/vendor-report
 *   ?lat&lng | ?address | &radius (km, default 0.5, capped 2) | &excludeAddress
 * Coverage is restricted to City of Casey + Shire of Cardinia; a subject outside
 * that area returns empty arrays by design.
 */
// Read per-call (not at module load) so env overrides in tests, or a
// late-configured deploy, take effect — matches markdown-loader.ts's
// propertiesDir() pattern.
function apiUrl(): string {
  return process.env.EVERYPROPERTY_API_URL || "https://geaeverypropertyai-production.up.railway.app";
}
function apiKey(): string {
  return process.env.EVERYPROPERTY_API_KEY || "";
}
const TIMEOUT_MS = 30_000;

export interface SoldComp {
  rawAddress: string;
  suburb: string | null;
  postcode: string | null;
  salePrice: number | null;
  saleDate: string | null;
  landAreaSqm: number | null;
  propertyType: string | null;
  latitude: number | null;
  longitude: number | null;
  agencyName: string | null;
  agentName: string | null;
  listingUrl: string | null;
  imageUrl: string | null;
  distanceMetres: number | null;
}

export interface ListingComp {
  rawAddress: string;
  suburb: string | null;
  postcode: string | null;
  displayPrice: string | null;
  priceLow: number | null;
  priceHigh: number | null;
  status: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  carSpaces: number | null;
  landAreaSqm: number | null;
  propertyType: string | null;
  latitude: number | null;
  longitude: number | null;
  agencyName: string | null;
  agentName: string | null;
  listingUrl: string | null;
  imageUrl: string | null;
  distanceMetres: number | null;
}

export interface VendorReportComps {
  solds: SoldComp[];
  listings: ListingComp[];
}

export interface CompsQuery {
  lat?: number | null;
  lng?: number | null;
  address?: string;
  /** Radius in km. Endpoint default 0.5 (500m), capped at 2. */
  radius?: number;
  /** Drops the subject's own row from results (exact, case-insensitive). */
  excludeAddress?: string;
}

const EMPTY: VendorReportComps = { solds: [], listings: [] };

export interface PropertyDetails {
  bedrooms: number | null;
  bathrooms: number | null;
  carSpaces: number | null;
  landAreaSqm: number | null;
  propertyType: string | null;
}

const EMPTY_DETAILS: PropertyDetails = {
  bedrooms: null,
  bathrooms: null,
  carSpaces: null,
  landAreaSqm: null,
  propertyType: null,
};

/**
 * Fetch attribute enrichment (beds/baths/car spaces/land size/type) for a
 * subject address.
 *
 * ASSUMPTION: this endpoint's path (`/api/property-details`) has not been
 * confirmed against the live everypropertyai backend — only `/api/vendor-report`
 * (used by getVendorReportComps above) is proven to exist in this codebase.
 * Fails soft to EMPTY_DETAILS on any error, same posture as getVendorReportComps,
 * so an unconfirmed/wrong path degrades gracefully rather than breaking enrichment.
 */
export async function getPropertyDetails(address: string): Promise<PropertyDetails> {
  if (!apiKey() || !address) return EMPTY_DETAILS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const qs = new URLSearchParams({ address });
    const res = await fetch(`${apiUrl()}/api/property-details?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return EMPTY_DETAILS;
    const data = (await res.json()) as Partial<PropertyDetails>;
    return {
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      carSpaces: data.carSpaces ?? null,
      landAreaSqm: data.landAreaSqm ?? null,
      propertyType: data.propertyType ?? null,
    };
  } catch {
    return EMPTY_DETAILS;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch nearby comparable solds + new listings for a subject property.
 * Fails soft: any missing key / non-200 / network error / timeout returns
 * empty arrays so the report still renders.
 */
export async function getVendorReportComps(query: CompsQuery): Promise<VendorReportComps> {
  if (!apiKey()) return EMPTY;
  if (query.lat == null && query.lng == null && !query.address) return EMPTY;

  const qs = new URLSearchParams();
  if (query.lat != null && query.lng != null) {
    qs.set("lat", String(query.lat));
    qs.set("lng", String(query.lng));
  } else if (query.address) {
    qs.set("address", query.address);
  }
  if (query.radius != null) qs.set("radius", String(query.radius));
  if (query.excludeAddress) qs.set("excludeAddress", query.excludeAddress);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${apiUrl()}/api/vendor-report?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as Partial<VendorReportComps>;
    return {
      solds: Array.isArray(data.solds) ? data.solds : [],
      listings: Array.isArray(data.listings) ? data.listings : [],
    };
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}
