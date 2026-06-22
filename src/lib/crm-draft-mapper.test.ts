import { describe, it, expect } from 'vitest';
import { applyCrmToDraft } from '@/lib/crm-draft-mapper';
import type { WeeklyDraft } from '@/lib/types';
import type { ReportListing, CrmStat } from '@/lib/crm-client';

function baseDraft(overrides: Partial<WeeklyDraft> = {}): WeeklyDraft {
  return {
    id: 'slug--2026-06-21',
    propertySlug: 'slug',
    weekEnding: '2026-06-21',
    status: 'draft',
    approvedAt: null,
    propertyAddress: 'old address',
    vendorName: 'Old Vendor',
    agent: 'Old Agent',
    askingPrice: '',
    campaignType: 'Private Sale',
    listingDate: '',
    daysOnMarket: 0,
    reaViews: 0,
    reaEnquiries: 0,
    reaSaves: 0,
    reaSearchAppearances: 0,
    domainViews: 0,
    domainEnquiries: 0,
    domainSaves: 0,
    domainSearchAppearances: 0,
    openHomeAttendees: 0,
    privateInspections: 0,
    agentCommentary: '',
    newsArticles: [],
    generatedNarrative: null,
    messages: [],
    ...overrides,
  };
}

const stat = (value: number | null, gap = false): CrmStat => ({
  value,
  source: gap ? null : 'rea',
  capturedAt: gap ? null : '2026-06-20T09:00:00Z',
  gap,
});

function report(overrides: Partial<ReportListing> = {}): ReportListing {
  return {
    listing: {
      id: 'lst_1',
      vaultExternalId: 'VRE-1',
      type: 'FOR_SALE',
      propertyAddress: '14 Real St',
      suburb: 'Berwick',
      postcode: '3806',
      state: 'VIC',
      propertyType: 'House',
      bedrooms: 3,
      bathrooms: 2,
      carSpaces: 1,
      price: 1850000,
      priceGuide: '$1.8m - $1.95m',
      listedDate: '2026-06-01',
      daysOnMarket: 20,
      agentName: 'Stuart Grant',
      vendorName: 'Jane Vendor',
      soldPrice: null,
      soldDate: null,
      ownerContactId: 'ct_1',
    },
    stats: {
      openHomes: stat(12),
      inspections: stat(3),
    },
    statsByPortal: {
      rea: { views: stat(400), enquiries: stat(8), saves: stat(15), searchAppearances: stat(900) },
      domain: { views: stat(115), enquiries: stat(2), saves: stat(5), searchAppearances: stat(300) },
    },
    ...overrides,
  };
}

describe('applyCrmToDraft', () => {
  it('fills REA and Domain split values into the right fields', () => {
    const out = applyCrmToDraft(baseDraft(), report());
    expect(out.reaViews).toBe(400);
    expect(out.domainViews).toBe(115);
    expect(out.reaEnquiries).toBe(8);
    expect(out.domainSaves).toBe(5);
    expect(out.fieldSources?.reaViews).toMatchObject({ source: 'rea', gap: false });
  });

  it('maps combined open-home / inspection counts from stats', () => {
    const out = applyCrmToDraft(baseDraft(), report());
    expect(out.openHomeAttendees).toBe(12);
    expect(out.privateInspections).toBe(3);
  });

  it('maps property metadata fields', () => {
    const out = applyCrmToDraft(baseDraft(), report());
    expect(out.propertyAddress).toBe('14 Real St');
    expect(out.askingPrice).toBe('$1.8m - $1.95m');
    expect(out.listingDate).toBe('2026-06-01');
    expect(out.daysOnMarket).toBe(20);
    expect(out.agent).toBe('Stuart Grant');
    expect(out.vendorName).toBe('Jane Vendor');
  });

  it('marks a gap metric and leaves the value, recording gap:true', () => {
    const r = report({
      statsByPortal: {
        rea: { views: stat(null, true), enquiries: stat(8), saves: stat(15), searchAppearances: stat(900) },
        domain: { views: stat(115), enquiries: stat(2), saves: stat(5), searchAppearances: stat(300) },
      },
    });
    const out = applyCrmToDraft(baseDraft({ reaViews: 0 }), r);
    expect(out.reaViews).toBe(0); // unchanged
    expect(out.fieldSources?.reaViews.gap).toBe(true);
  });

  it('treats a real captured 0 as a value, not a gap', () => {
    const r = report({
      statsByPortal: {
        rea: { views: stat(0), enquiries: stat(8), saves: stat(15), searchAppearances: stat(900) },
        domain: { views: stat(115), enquiries: stat(2), saves: stat(5), searchAppearances: stat(300) },
      },
    });
    const out = applyCrmToDraft(baseDraft({ reaViews: 99 }), r);
    expect(out.reaViews).toBe(0);
    expect(out.fieldSources?.reaViews.gap).toBe(false);
  });

  it('never overwrites an agent-edited field', () => {
    const draft = baseDraft({ reaViews: 777, agentEdited: ['reaViews'] });
    const out = applyCrmToDraft(draft, report());
    expect(out.reaViews).toBe(777); // agent value preserved
    expect(out.fieldSources?.reaViews).toBeUndefined();
  });

  it('marks domain fields gap when the domain source is missing entirely', () => {
    const r = report({
      statsByPortal: {
        rea: { views: stat(400), enquiries: stat(8), saves: stat(15), searchAppearances: stat(900) },
      },
    });
    const out = applyCrmToDraft(baseDraft(), r);
    expect(out.reaViews).toBe(400);
    expect(out.fieldSources?.domainViews.gap).toBe(true);
  });

  it('marks all mapped non-edited fields gap when the report is null', () => {
    const out = applyCrmToDraft(baseDraft({ agentEdited: ['reaViews'] }), null);
    expect(out.fieldSources?.domainViews.gap).toBe(true);
    expect(out.fieldSources?.openHomeAttendees.gap).toBe(true);
    expect(out.fieldSources?.reaViews).toBeUndefined(); // edited, untouched
  });
});
