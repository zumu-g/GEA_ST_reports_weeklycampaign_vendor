import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { PropertyData } from '@/lib/markdown-loader';

vi.mock('@/lib/markdown-loader', async () => {
  const actual = await vi.importActual<typeof import('@/lib/markdown-loader')>('@/lib/markdown-loader');
  return { ...actual, getAllProperties: vi.fn(), getProperty: vi.fn() };
});
vi.mock('@/lib/crm-client', () => ({
  resolveListing: vi.fn().mockResolvedValue({ ok: true, data: null }),
  getReportListing: vi.fn(),
  // Not configured -> live-properties.ts falls back to the markdown set
  // unfiltered, which is what these broadcast tests exercise.
  isCrmConfigured: vi.fn().mockReturnValue(false),
  listAllListings: vi.fn(),
}));

import { getAllProperties, getProperty } from '@/lib/markdown-loader';
import { broadcastArticleToAllDrafts, getWeeklyDraft, saveWeeklyDraft } from '@/lib/weekly-drafts';
import type { WeeklyDraft } from '@/lib/types';

const getAllPropertiesMock = vi.mocked(getAllProperties);
const getPropertyMock = vi.mocked(getProperty);

function property(slug: string): PropertyData {
  return {
    slug,
    address: `${slug} St`,
    owner: '',
    contact: '',
    listed: '2026-06-01',
    priceGuide: '$1m',
    campaignType: 'Private Sale',
    agent: 'Stuart Grant',
    calendarId: '',
    crmListingId: '',
    checklist: [],
    latestUpdate: '',
    analytics: [],
    inspections: [],
    communications: [],
    news: [], benchmarks: [],
  };
}

const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-broadcast-'));
  process.env.PROPERTIES_DIR = tmp;
  vi.clearAllMocks();
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  await fs.rm(tmp, { recursive: true, force: true });
});

const article = { title: 'Three graphs', url: 'https://example.com/a', note: 'summary' };

describe('broadcastArticleToAllDrafts', () => {
  it('generates a draft and adds the article for every property with no existing draft', async () => {
    getAllPropertiesMock.mockResolvedValue(['a', 'b', 'c'].map(property));
    getPropertyMock.mockImplementation(async (slug: string) => property(slug));

    const result = await broadcastArticleToAllDrafts(article, '2026-07-19');

    expect(result.updated.sort()).toEqual(['a', 'b', 'c']);
    expect(result.skipped).toEqual([]);

    for (const slug of ['a', 'b', 'c']) {
      const draft = await getWeeklyDraft(slug, '2026-07-19');
      expect(draft?.newsArticles).toEqual([expect.objectContaining(article)]);
    }
  });

  it('appends to an existing draft without disturbing other fields', async () => {
    getAllPropertiesMock.mockResolvedValue([property('a')]);
    getPropertyMock.mockResolvedValue(property('a'));

    const existing: WeeklyDraft = {
      id: 'a--2026-07-19', propertySlug: 'a', weekEnding: '2026-07-19', status: 'draft', approvedAt: null,
      propertyAddress: 'a St', vendorName: '', agent: '', askingPrice: '', campaignType: 'Private Sale',
      listingDate: '', daysOnMarket: 0, reaViews: 5, reaEnquiries: 0, reaSaves: 0, reaSearchAppearances: 0,
      domainViews: 0, domainEnquiries: 0, domainSaves: 0, domainSearchAppearances: 0, openHomeAttendees: 0,
      privateInspections: 0, agentCommentary: 'hello', newsArticles: [], generatedNarrative: null,
      messages: [], fieldSources: {}, agentEdited: [],
    };
    await saveWeeklyDraft(existing);

    const result = await broadcastArticleToAllDrafts(article, '2026-07-19');
    expect(result.updated).toEqual(['a']);

    const draft = await getWeeklyDraft('a', '2026-07-19');
    expect(draft?.newsArticles).toEqual([expect.objectContaining(article)]);
    expect(draft?.reaViews).toBe(5);
    expect(draft?.agentCommentary).toBe('hello');
  });

  it('skips (dedupes) a property whose draft already has this article url', async () => {
    getAllPropertiesMock.mockResolvedValue([property('a')]);
    getPropertyMock.mockResolvedValue(property('a'));

    const existing: WeeklyDraft = {
      id: 'a--2026-07-19', propertySlug: 'a', weekEnding: '2026-07-19', status: 'draft', approvedAt: null,
      propertyAddress: 'a St', vendorName: '', agent: '', askingPrice: '', campaignType: 'Private Sale',
      listingDate: '', daysOnMarket: 0, reaViews: 0, reaEnquiries: 0, reaSaves: 0, reaSearchAppearances: 0,
      domainViews: 0, domainEnquiries: 0, domainSaves: 0, domainSearchAppearances: 0, openHomeAttendees: 0,
      privateInspections: 0, agentCommentary: '', newsArticles: [{ id: '1', ...article }],
      generatedNarrative: null, messages: [], fieldSources: {}, agentEdited: [],
    };
    await saveWeeklyDraft(existing);

    const result = await broadcastArticleToAllDrafts(article, '2026-07-19');
    expect(result.updated).toEqual([]);
    expect(result.skipped).toEqual(['a']);

    const draft = await getWeeklyDraft('a', '2026-07-19');
    expect(draft?.newsArticles).toHaveLength(1);
  });

  it('records a property as skipped instead of aborting the whole broadcast when draft generation fails', async () => {
    getAllPropertiesMock.mockResolvedValue([property('good'), property('bad')]);
    getPropertyMock.mockImplementation(async (slug: string) =>
      slug === 'bad' ? null : property(slug)
    );

    const result = await broadcastArticleToAllDrafts(article, '2026-07-19');
    expect(result.updated).toEqual(['good']);
    expect(result.skipped).toEqual(['bad']);
  });
});
