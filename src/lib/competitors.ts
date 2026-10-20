import { getStorage } from './storage';
import { assertSafeSlug } from './markdown-loader';
import type { ListingComp } from './everypropertyai';

export interface CompetitorListing {
  address: string;
  askingLow: number | null;
  askingHigh: number | null;
  status: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
}

export interface CompetitorSnapshot {
  capturedAt: string;
  listings: CompetitorListing[];
}

export type CompetitorEventType = 'new' | 'price-change' | 'under-offer' | 'sold' | 'withdrawn';

export interface CompetitorEvent {
  type: CompetitorEventType;
  address: string;
  detail?: string;
}

const MAX_SNAPSHOTS = 12;

export async function readCompetitorSnapshots(slug: string): Promise<CompetitorSnapshot[]> {
  return getStorage().readList<CompetitorSnapshot>(`${slug}/competitors.json`);
}

// Parses a free-text price guide ("$680k-$720k", "$1.2m") into a midpoint in
// dollars. Returns null when nothing numeric can be extracted — the bracket
// filter then falls back to including every listing rather than guessing.
export function parsePriceGuideMidpoint(priceGuide: string): number | null {
  const toDollars = (raw: string): number | null => {
    const m = raw.match(/([\d.]+)\s*(k|m)?/i);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (isNaN(n)) return null;
    const unit = m[2]?.toLowerCase();
    if (unit === 'k') return n * 1_000;
    if (unit === 'm') return n * 1_000_000;
    return n;
  };
  const nums = priceGuide.match(/\$?[\d.]+\s*[km]?/gi) ?? [];
  const values = nums.map(toDollars).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  return (values[0] + values[1]) / 2;
}

// Builds a snapshot from the listings the confirmed everypropertyai
// /api/vendor-report call already returns, filtered to ±15% of the price
// guide midpoint when one is known (KTD6). No dedicated on-market-listings
// call — that endpoint is unconfirmed against the live backend.
export function buildCompetitorSnapshot(
  listings: ListingComp[],
  priceGuide: string | null
): CompetitorSnapshot {
  const midpoint = priceGuide ? parsePriceGuideMidpoint(priceGuide) : null;
  const inBracket = (c: ListingComp): boolean => {
    if (midpoint === null) return true;
    const lo = midpoint * 0.85;
    const hi = midpoint * 1.15;
    const price = c.priceHigh ?? c.priceLow;
    if (price == null) return true; // keep listings with no numeric price rather than dropping them
    return price >= lo && price <= hi;
  };

  return {
    capturedAt: new Date().toISOString(),
    listings: listings
      .filter(inBracket)
      .slice(0, 12)
      .map(c => ({
        address: c.rawAddress,
        askingLow: c.priceLow,
        askingHigh: c.priceHigh,
        status: c.status,
        bedrooms: c.bedrooms,
        bathrooms: c.bathrooms,
      })),
  };
}

// Diffs two successive snapshots by address. A listing present in the
// earlier snapshot but absent from the later one is reported sold when its
// last-seen status says so, else withdrawn.
export function diffSnapshots(previous: CompetitorSnapshot | null, current: CompetitorSnapshot): CompetitorEvent[] {
  if (!previous) {
    return current.listings.map(l => ({ type: 'new', address: l.address }));
  }

  const events: CompetitorEvent[] = [];
  const prevByAddress = new Map(previous.listings.map(l => [l.address, l]));
  const currAddresses = new Set(current.listings.map(l => l.address));

  for (const curr of current.listings) {
    const prev = prevByAddress.get(curr.address);
    if (!prev) {
      events.push({ type: 'new', address: curr.address });
      continue;
    }
    if (curr.status && prev.status !== curr.status) {
      if (/under offer/i.test(curr.status)) {
        events.push({ type: 'under-offer', address: curr.address });
      } else if (/sold/i.test(curr.status)) {
        events.push({ type: 'sold', address: curr.address });
      }
    }
    if (curr.askingHigh != null && prev.askingHigh != null && curr.askingHigh !== prev.askingHigh) {
      const delta = curr.askingHigh - prev.askingHigh;
      events.push({ type: 'price-change', address: curr.address, detail: `${delta > 0 ? '+' : ''}${delta.toLocaleString('en-AU')}` });
    }
  }

  for (const prev of previous.listings) {
    if (!currAddresses.has(prev.address)) {
      const isSold = prev.status && /sold/i.test(prev.status);
      events.push({ type: isSold ? 'sold' : 'withdrawn', address: prev.address });
    }
  }

  return events;
}

// Appends a snapshot (capped to the last 12) and returns the diff against
// whatever snapshot preceded it.
export async function appendCompetitorSnapshot(
  slug: string,
  snapshot: CompetitorSnapshot
): Promise<CompetitorEvent[]> {
  assertSafeSlug(slug);
  const existing = await readCompetitorSnapshots(slug);
  const previous = existing[existing.length - 1] ?? null;
  const events = diffSnapshots(previous, snapshot);

  const updated = [...existing, snapshot].slice(-MAX_SNAPSHOTS);
  await getStorage().writeList(`${slug}/competitors.json`, updated);
  return events;
}
