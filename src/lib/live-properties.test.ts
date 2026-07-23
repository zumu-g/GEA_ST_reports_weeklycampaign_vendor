import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { CrmListing, ReportListing } from '@/lib/crm-client';

vi.mock('@/lib/crm-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm-client')>('@/lib/crm-client');
  return { ...actual, isCrmConfigured: vi.fn(), listAllListings: vi.fn() };
});

import { isCrmConfigured, listAllListings } from '@/lib/crm-client';
import { getLivePropertySet, normaliseAddress, isHiddenFromPortal } from '@/lib/live-properties';
import { createPropertyFolder, getProperty } from '@/lib/markdown-loader';

const isCrmConfiguredMock = vi.mocked(isCrmConfigured);
const listAllListingsMock = vi.mocked(listAllListings);

const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-live-properties-'));
  process.env.PROPERTIES_DIR = tmp;
  vi.clearAllMocks();
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  await fs.rm(tmp, { recursive: true, force: true });
});

function listing(overrides: Partial<CrmListing> & { id: string; propertyAddress: string }): CrmListing {
  return {
    vaultExternalId: null,
    type: 'Private Sale',
    suburb: null,
    postcode: null,
    state: null,
    propertyType: null,
    bedrooms: null,
    bathrooms: null,
    carSpaces: null,
    price: null,
    priceGuide: '$1m',
    listedDate: '2026-01-01',
    daysOnMarket: null,
    agentName: 'Stuart Grant',
    vendorName: 'A Vendor',
    soldPrice: null,
    soldDate: null,
    ownerContactId: null,
    ...overrides,
  };
}

function reportListing(l: CrmListing): ReportListing {
  return { listing: l, stats: {}, statsByPortal: {} };
}

describe('normaliseAddress', () => {
  it('treats format variants as equal', () => {
    expect(normaliseAddress('85 Centenary Boulevard, Officer South VIC 3809')).toEqual(
      normaliseAddress('85 Centenary Blvd, Officer South')
    );
  });
});

describe('isHiddenFromPortal (U4)', () => {
  it('hides a slug the CRM confirms is not in the live set', () => {
    expect(isHiddenFromPortal('stale', { slugs: ['live-one'], source: 'crm' })).toBe(true);
  });

  it('shows a slug that is in the live set', () => {
    expect(isHiddenFromPortal('live-one', { slugs: ['live-one'], source: 'crm' })).toBe(false);
  });

  it('never hides on a CRM outage (fail-open), even for a slug absent from the fallback list', () => {
    expect(isHiddenFromPortal('anything', { slugs: ['live-one'], source: 'markdown-fallback' })).toBe(false);
  });
});

describe('getLivePropertySet', () => {
  it('falls back to the markdown set, unhidden, when the CRM is not configured', async () => {
    isCrmConfiguredMock.mockReturnValue(false);
    await createPropertyFolder('a-st', { address: 'A St', owner: 'O', contact: '', listed: '', priceGuide: '', campaignType: '' });

    const result = await getLivePropertySet();
    expect(result.source).toBe('markdown-fallback');
    expect(result.allSlugs).toEqual(['a-st']);
    expect(result.hiddenSlugs).toEqual([]);
  });

  it('falls back loudly when listAllListings errors', async () => {
    isCrmConfiguredMock.mockReturnValue(true);
    listAllListingsMock.mockResolvedValue({ ok: false, error: 'CRM request failed: timeout' });
    await createPropertyFolder('a-st', { address: 'A St', owner: 'O', contact: '', listed: '', priceGuide: '', campaignType: '' });

    const result = await getLivePropertySet();
    expect(result.source).toBe('markdown-fallback');
    expect(result.crmError).toBe('CRM request failed: timeout');
    expect(result.allSlugs).toEqual(['a-st']);
  });

  it('matches an existing folder by normalised address and writes back the CRM listing id', async () => {
    isCrmConfiguredMock.mockReturnValue(true);
    await createPropertyFolder('85-centenary-blvd-officer-south', {
      address: '85 Centenary Boulevard, Officer South VIC 3809',
      owner: 'Vikram', contact: '', listed: '', priceGuide: '$680k', campaignType: 'Private Sale',
    });
    const l = listing({ id: 'crm-1', propertyAddress: '85 Centenary Boulevard, Officer South VIC 3809' });
    listAllListingsMock.mockResolvedValue({ ok: true, data: [reportListing(l)] });

    const result = await getLivePropertySet();
    expect(result.source).toBe('crm');
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].slug).toBe('85-centenary-blvd-officer-south');
    expect(result.hiddenSlugs).toEqual([]);

    const updated = await getProperty('85-centenary-blvd-officer-south');
    expect(updated?.crmListingId).toBe('crm-1');
  });

  it('matches an existing folder when the CRM propertyAddress omits the suburb (composed from suburb/state/postcode)', async () => {
    // Regression: a real CRM payload had propertyAddress "17 Juliet Gardens"
    // with suburb/state/postcode as separate DTO fields — matching on
    // propertyAddress alone missed the existing "...pakenham" folder and
    // auto-created a duplicate.
    isCrmConfiguredMock.mockReturnValue(true);
    await createPropertyFolder('17-juliet-gardens-pakenham', {
      address: '17 Juliet Gardens, Pakenham VIC 3810',
      owner: 'Lynn', contact: '', listed: '', priceGuide: '', campaignType: 'Private Sale',
    });
    const l = listing({ id: 'crm-2', propertyAddress: '17 Juliet Gardens', suburb: 'Pakenham', state: 'VIC', postcode: '3810' });
    listAllListingsMock.mockResolvedValue({ ok: true, data: [reportListing(l)] });

    const result = await getLivePropertySet();
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].slug).toBe('17-juliet-gardens-pakenham');
    expect(result.conflicts).toEqual([]);
  });

  it('matches by stored CRM listing id on subsequent runs without re-parsing address', async () => {
    isCrmConfiguredMock.mockReturnValue(true);
    await createPropertyFolder('85-centenary-blvd-officer-south', {
      address: 'Some address that no longer matches anything',
      owner: 'Vikram', contact: '', listed: '', priceGuide: '$680k', campaignType: 'Private Sale',
      crmListingId: 'crm-1',
    });
    const l = listing({ id: 'crm-1', propertyAddress: '85 Centenary Boulevard, Officer South VIC 3809' });
    listAllListingsMock.mockResolvedValue({ ok: true, data: [reportListing(l)] });

    const result = await getLivePropertySet();
    expect(result.properties[0].slug).toBe('85-centenary-blvd-officer-south');
  });

  it('hides a local folder whose listing is not in the live CRM set', async () => {
    isCrmConfiguredMock.mockReturnValue(true);
    await createPropertyFolder('live-one', { address: 'Live One St', owner: 'O', contact: '', listed: '', priceGuide: '', campaignType: '' });
    await createPropertyFolder('stale-two', { address: 'Stale Two St', owner: 'O', contact: '', listed: '', priceGuide: '', campaignType: '' });
    listAllListingsMock.mockResolvedValue({
      ok: true,
      data: [reportListing(listing({ id: 'l1', propertyAddress: 'Live One St' }))],
    });

    const result = await getLivePropertySet();
    expect(result.properties.map((p) => p.slug)).toEqual(['live-one']);
    expect(result.hiddenSlugs).toEqual(['stale-two']);
  });

  it('treats a valid empty CRM listing set as zero live properties, not a fallback', async () => {
    isCrmConfiguredMock.mockReturnValue(true);
    await createPropertyFolder('a-st', { address: 'A St', owner: 'O', contact: '', listed: '', priceGuide: '', campaignType: '' });
    listAllListingsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await getLivePropertySet();
    expect(result.source).toBe('crm');
    expect(result.properties).toEqual([]);
    expect(result.hiddenSlugs).toEqual(['a-st']);
  });

  it('auto-creates a folder for a live listing with no matching local folder', async () => {
    isCrmConfiguredMock.mockReturnValue(true);
    listAllListingsMock.mockResolvedValue({
      ok: true,
      data: [reportListing(listing({ id: 'new-1', propertyAddress: '10 New Street, Newtown VIC 3000', vendorName: 'Jo Vendor' }))],
    });

    const result = await getLivePropertySet();
    expect(result.properties).toHaveLength(1);
    const slug = result.properties[0].slug;
    expect(result.properties[0].property?.slug).toBe(slug); // re-read after creation, not left null
    const created = await getProperty(slug);
    expect(created?.address).toBe('10 New Street, Newtown VIC 3000');
    expect(created?.owner).toBe('Jo Vendor');
    expect(created?.crmListingId).toBe('new-1');
  });

  it('is idempotent: running twice does not duplicate an auto-created folder', async () => {
    isCrmConfiguredMock.mockReturnValue(true);
    const l = listing({ id: 'new-1', propertyAddress: '10 New Street, Newtown VIC 3000' });
    listAllListingsMock.mockResolvedValue({ ok: true, data: [reportListing(l)] });

    const first = await getLivePropertySet();
    const second = await getLivePropertySet();
    expect(second.properties).toHaveLength(1);
    expect(second.properties[0].slug).toBe(first.properties[0].slug);
    expect(second.conflicts).toEqual([]);
  });

  it('records a conflict instead of overwriting when the derived slug collides with an unrelated folder', async () => {
    isCrmConfiguredMock.mockReturnValue(true);
    await createPropertyFolder('10-new-street-newtown', {
      address: 'A totally different address', owner: 'Unrelated Owner', contact: '', listed: '', priceGuide: '', campaignType: '',
    });
    listAllListingsMock.mockResolvedValue({
      ok: true,
      data: [reportListing(listing({ id: 'new-1', propertyAddress: '10 New Street, Newtown VIC 3000' }))],
    });

    const result = await getLivePropertySet();
    expect(result.properties).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toMatch(/already exists/);
  });

  it('skips a listing with no usable address without crashing the whole resolve', async () => {
    isCrmConfiguredMock.mockReturnValue(true);
    listAllListingsMock.mockResolvedValue({
      ok: true,
      data: [
        reportListing(listing({ id: 'bad', propertyAddress: '   ' })),
        reportListing(listing({ id: 'good', propertyAddress: '5 Good St, Goodtown VIC 3000' })),
      ],
    });

    const result = await getLivePropertySet();
    expect(result.properties).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].listing.id).toBe('bad');
  });

  it('does not let two same-run listings that derive the same slug overwrite each other', async () => {
    // Regression: the collision guard used a static snapshot of existing
    // slugs, so a second listing deriving the same slug as one just
    // auto-created earlier in this run wasn't detected and would silently
    // overwrite the first via createPropertyFolder's plain fs.writeFile.
    isCrmConfiguredMock.mockReturnValue(true);
    listAllListingsMock.mockResolvedValue({
      ok: true,
      data: [
        reportListing(listing({ id: 'first', propertyAddress: '1 Same St, Sametown VIC 3000' })),
        reportListing(listing({ id: 'second', propertyAddress: '1 Same St, Sametown VIC 3000', vendorName: 'Different Vendor' })),
      ],
    });

    const result = await getLivePropertySet();
    expect(result.properties).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].listing.id).toBe('second');

    const slug = result.properties[0].slug;
    const onDisk = await getProperty(slug);
    expect(onDisk?.crmListingId).toBe('first'); // not overwritten by "second"
  });
});
