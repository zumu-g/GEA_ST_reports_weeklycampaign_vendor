import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  parsePriceGuideMidpoint,
  buildCompetitorSnapshot,
  diffSnapshots,
  appendCompetitorSnapshot,
  readCompetitorSnapshots,
  type CompetitorSnapshot,
} from './competitors';
import type { ListingComp } from './everypropertyai';

function listing(overrides: Partial<ListingComp> = {}): ListingComp {
  return {
    rawAddress: '1 Test St',
    suburb: null, postcode: null, displayPrice: null, priceLow: null, priceHigh: null,
    status: null, bedrooms: null, bathrooms: null, carSpaces: null, landAreaSqm: null,
    propertyType: null, latitude: null, longitude: null, agencyName: null, agentName: null,
    listingUrl: null, imageUrl: null, distanceMetres: null,
    ...overrides,
  };
}

describe('parsePriceGuideMidpoint', () => {
  it('parses a $680k-$720k range to its midpoint', () => {
    expect(parsePriceGuideMidpoint('$680k-$720k')).toBe(700_000);
  });

  it('parses a single $1.2m figure', () => {
    expect(parsePriceGuideMidpoint('$1.2m')).toBe(1_200_000);
  });

  it('returns null for text with no numeric figure', () => {
    expect(parsePriceGuideMidpoint('TBC')).toBeNull();
  });
});

describe('buildCompetitorSnapshot', () => {
  it('filters to listings within plus or minus 15 percent of the price guide midpoint', () => {
    const listings = [
      listing({ rawAddress: 'In bracket', priceHigh: 710_000 }),
      listing({ rawAddress: 'Too cheap', priceHigh: 500_000 }),
      listing({ rawAddress: 'Too expensive', priceHigh: 1_000_000 }),
    ];
    const snapshot = buildCompetitorSnapshot(listings, '$680k-$720k');
    expect(snapshot.listings.map(l => l.address)).toEqual(['In bracket']);
  });

  it('keeps every listing when the price guide has no parseable figure', () => {
    const listings = [listing({ rawAddress: 'A' }), listing({ rawAddress: 'B', priceHigh: 2_000_000 })];
    const snapshot = buildCompetitorSnapshot(listings, 'TBC');
    expect(snapshot.listings).toHaveLength(2);
  });
});

describe('diffSnapshots', () => {
  it('reports every listing as new when there is no previous snapshot', () => {
    const current: CompetitorSnapshot = { capturedAt: 'x', listings: [{ address: 'A', askingLow: null, askingHigh: null, status: null, bedrooms: null, bathrooms: null }] };
    expect(diffSnapshots(null, current)).toEqual([{ type: 'new', address: 'A' }]);
  });

  it('reports a price change with the delta', () => {
    const previous: CompetitorSnapshot = { capturedAt: 'x', listings: [{ address: 'A', askingLow: null, askingHigh: 720_000, status: 'For Sale', bedrooms: null, bathrooms: null }] };
    const current: CompetitorSnapshot = { capturedAt: 'y', listings: [{ address: 'A', askingLow: null, askingHigh: 699_000, status: 'For Sale', bedrooms: null, bathrooms: null }] };
    const events = diffSnapshots(previous, current);
    expect(events).toEqual([{ type: 'price-change', address: 'A', detail: '-21,000' }]);
  });

  it('reports a listing that disappears as sold when its last status said sold, else withdrawn', () => {
    const previous: CompetitorSnapshot = {
      capturedAt: 'x',
      listings: [
        { address: 'Sold one', askingLow: null, askingHigh: null, status: 'Sold', bedrooms: null, bathrooms: null },
        { address: 'Gone one', askingLow: null, askingHigh: null, status: 'For Sale', bedrooms: null, bathrooms: null },
      ],
    };
    const current: CompetitorSnapshot = { capturedAt: 'y', listings: [] };
    const events = diffSnapshots(previous, current);
    expect(events).toContainEqual({ type: 'sold', address: 'Sold one' });
    expect(events).toContainEqual({ type: 'withdrawn', address: 'Gone one' });
  });

  it('reports an under-offer status change', () => {
    const previous: CompetitorSnapshot = { capturedAt: 'x', listings: [{ address: 'A', askingLow: null, askingHigh: null, status: 'For Sale', bedrooms: null, bathrooms: null }] };
    const current: CompetitorSnapshot = { capturedAt: 'y', listings: [{ address: 'A', askingLow: null, askingHigh: null, status: 'Under Offer', bedrooms: null, bathrooms: null }] };
    expect(diffSnapshots(previous, current)).toEqual([{ type: 'under-offer', address: 'A' }]);
  });
});

describe('appendCompetitorSnapshot', () => {
  const SLUG = 'test-competitors-slug';
  const origDir = process.env.PROPERTIES_DIR;
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-competitors-'));
    process.env.PROPERTIES_DIR = tmp;
  });
  afterEach(async () => {
    process.env.PROPERTIES_DIR = origDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('caps stored snapshots at 12 after 13 appends', async () => {
    for (let i = 0; i < 13; i++) {
      await appendCompetitorSnapshot(SLUG, { capturedAt: `t${i}`, listings: [] });
    }
    const stored = await readCompetitorSnapshots(SLUG);
    expect(stored).toHaveLength(12);
    expect(stored[0].capturedAt).toBe('t1'); // oldest (t0) dropped
  });

  it('returns the diff against the snapshot it just replaced as the latest', async () => {
    await appendCompetitorSnapshot(SLUG, { capturedAt: 't0', listings: [{ address: 'A', askingLow: null, askingHigh: null, status: null, bedrooms: null, bathrooms: null }] });
    const events = await appendCompetitorSnapshot(SLUG, { capturedAt: 't1', listings: [] });
    expect(events).toEqual([{ type: 'withdrawn', address: 'A' }]);
  });
});
