import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { WeeklyDraft } from '@/lib/types';
import type { PropertyData } from '@/lib/markdown-loader';

// Mock the CRM client so enrichDraftFromCrm can be exercised without network.
vi.mock('@/lib/crm-client', () => ({
  resolveListing: vi.fn(),
  getReportListing: vi.fn(),
}));
vi.mock('@/lib/live-properties', () => ({ getLivePropertyData: vi.fn() }));

import { resolveListing, getReportListing } from '@/lib/crm-client';
import { getLivePropertyData } from '@/lib/live-properties';
import { enrichDraftFromCrm, generateAllWeeklyDrafts, getWeeklyDraft } from '@/lib/weekly-drafts';
import { createPropertyFolder } from '@/lib/markdown-loader';

const resolveMock = vi.mocked(resolveListing);
const listingMock = vi.mocked(getReportListing);
const getLivePropertyDataMock = vi.mocked(getLivePropertyData);

function property(slug: string): PropertyData {
  return {
    slug, address: `${slug} St`, owner: '', contact: '', listed: '2026-06-01', priceGuide: '$1m',
    campaignType: 'Private Sale', agent: 'Stuart Grant', calendarId: '', crmListingId: '',
    checklist: [], latestUpdate: '', analytics: [], inspections: [], communications: [], news: [], benchmarks: [],
  };
}

function draft(overrides: Partial<WeeklyDraft> = {}): WeeklyDraft {
  return {
    id: 'slug--2026-06-21', propertySlug: 'slug', weekEnding: '2026-06-21',
    status: 'draft', approvedAt: null, propertyAddress: '14 Real St', vendorName: '',
    agent: '', askingPrice: '', campaignType: 'Private Sale', listingDate: '', daysOnMarket: 0,
    reaViews: 0, reaEnquiries: 0, reaSaves: 0, reaSearchAppearances: 0,
    domainViews: 0, domainEnquiries: 0, domainSaves: 0, domainSearchAppearances: 0,
    openHomeAttendees: 0, privateInspections: 0, agentCommentary: '', newsArticles: [],
    generatedNarrative: null, messages: [], fieldSources: {}, agentEdited: [], ...overrides,
  };
}

const stat = (value: number) => ({ value, source: 'rea', capturedAt: '2026-06-20T00:00:00Z', gap: false });

beforeEach(() => vi.clearAllMocks());

describe('enrichDraftFromCrm', () => {
  it('fills fields from the CRM when the listing resolves', async () => {
    resolveMock.mockResolvedValue({ ok: true, data: { listingId: 'lst_1', vaultExternalId: 'VRE-1' } });
    listingMock.mockResolvedValue({
      ok: true,
      data: {
        listing: { id: 'lst_1', vaultExternalId: 'VRE-1', type: 'FOR_SALE', propertyAddress: '14 Real St',
          suburb: null, postcode: null, state: null, propertyType: null, bedrooms: null, bathrooms: null,
          carSpaces: null, price: null, priceGuide: '$1.8m', listedDate: '2026-06-01', daysOnMarket: 20,
          agentName: 'Stuart Grant', vendorName: 'Jane', soldPrice: null, soldDate: null, ownerContactId: null },
        stats: { openHomes: stat(12), inspections: stat(3) },
        statsByPortal: { rea: { views: stat(400) }, domain: { views: stat(115) } },
      },
    });

    const out = await enrichDraftFromCrm(draft());
    expect(out.reaViews).toBe(400);
    expect(out.domainViews).toBe(115);
    expect(out.askingPrice).toBe('$1.8m');
    expect(out.fieldSources?.reaViews.gap).toBe(false);
  });

  it('marks gaps when the listing does not resolve (404)', async () => {
    resolveMock.mockResolvedValue({ ok: true, data: null });
    const out = await enrichDraftFromCrm(draft());
    expect(out.fieldSources?.reaViews.gap).toBe(true);
    expect(listingMock).not.toHaveBeenCalled();
  });

  it('marks gaps (no crash) when the CRM is unreachable', async () => {
    resolveMock.mockResolvedValue({ ok: false, error: 'CRM request failed' });
    const out = await enrichDraftFromCrm(draft());
    expect(out.fieldSources?.domainViews.gap).toBe(true);
  });

  it('preserves agent-edited fields across a refresh', async () => {
    resolveMock.mockResolvedValue({ ok: true, data: { listingId: 'lst_1', vaultExternalId: null } });
    listingMock.mockResolvedValue({
      ok: true,
      data: {
        listing: { id: 'lst_1', vaultExternalId: null, type: null, propertyAddress: '14 Real St',
          suburb: null, postcode: null, state: null, propertyType: null, bedrooms: null, bathrooms: null,
          carSpaces: null, price: null, priceGuide: null, listedDate: null, daysOnMarket: null,
          agentName: null, vendorName: null, soldPrice: null, soldDate: null, ownerContactId: null },
        stats: {},
        statsByPortal: { rea: { views: stat(400) } },
      },
    });
    const out = await enrichDraftFromCrm(draft({ reaViews: 777, agentEdited: ['reaViews'] }));
    expect(out.reaViews).toBe(777);
  });
});

describe('generateAllWeeklyDrafts (U3: honours the live property set)', () => {
  const origDir = process.env.PROPERTIES_DIR;
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-weekly-drafts-'));
    process.env.PROPERTIES_DIR = tmp;
  });

  afterEach(async () => {
    process.env.PROPERTIES_DIR = origDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  async function seedFolder(slug: string) {
    await createPropertyFolder(slug, { address: `${slug} St`, owner: 'O', contact: '', listed: '', priceGuide: '', campaignType: '' });
  }

  it('only generates drafts for live properties, skipping hidden folders', async () => {
    await seedFolder('live-one');
    await seedFolder('stale-two');
    getLivePropertyDataMock.mockResolvedValue({
      properties: [property('live-one')],
      source: 'crm',
    });

    const result = await generateAllWeeklyDrafts('2026-07-19');
    expect(result.created).toBe(1);
    expect(result.drafts.map((d) => d.propertySlug)).toEqual(['live-one']);
    expect(await getWeeklyDraft('stale-two', '2026-07-19')).toBeNull();
  });

  it('generates for every local folder when the CRM is unreachable (fail-open)', async () => {
    await seedFolder('a');
    await seedFolder('b');
    getLivePropertyDataMock.mockResolvedValue({
      properties: [property('a'), property('b')],
      source: 'markdown-fallback',
      crmError: 'CRM request failed',
    });

    const result = await generateAllWeeklyDrafts('2026-07-19');
    expect(result.created).toBe(2);
  });
});
