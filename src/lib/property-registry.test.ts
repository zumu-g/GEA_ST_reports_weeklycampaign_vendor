import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PropertyData } from '@/lib/markdown-loader';

vi.mock('@/lib/live-properties', () => ({ getLivePropertyData: vi.fn() }));

import { getLivePropertyData } from '@/lib/live-properties';
import { resolveProperty } from '@/lib/property-registry';

const getLivePropertyDataMock = vi.mocked(getLivePropertyData);

function property(slug: string, address: string, owner = 'Owner'): PropertyData {
  return {
    slug, address, owner, contact: '', listed: '', priceGuide: '', campaignType: '',
    agent: '', calendarId: '', crmListingId: '', checklist: [], latestUpdate: '',
    analytics: [], inspections: [], communications: [], news: [],
  };
}

beforeEach(() => vi.clearAllMocks());

describe('resolveProperty (U5: derived from the live set)', () => {
  it('resolves a street-number keyword', async () => {
    getLivePropertyDataMock.mockResolvedValue({
      properties: [property('85-centenary', '85 Centenary Boulevard, Officer South VIC 3809')],
      source: 'crm',
    });
    const result = await resolveProperty('85 centenary open 5 groups');
    expect(result?.slug).toBe('85-centenary');
  });

  it('returns null when a suburb keyword is shared by two live listings', async () => {
    getLivePropertyDataMock.mockResolvedValue({
      properties: [
        property('a', '1 First St, Officer South VIC 3809'),
        property('b', '2 Second St, Officer South VIC 3809'),
      ],
      source: 'crm',
    });
    const result = await resolveProperty('officer south note: hello');
    expect(result).toBeNull();
  });

  it('resolves a suburb keyword when only one live listing is in that suburb', async () => {
    getLivePropertyDataMock.mockResolvedValue({
      properties: [property('a', '1 First St, Berwick VIC 3806')],
      source: 'crm',
    });
    const result = await resolveProperty('berwick note: hello');
    expect(result?.slug).toBe('a');
  });

  it('no longer resolves a property that has left the live set', async () => {
    getLivePropertyDataMock.mockResolvedValue({ properties: [], source: 'crm' });
    const result = await resolveProperty('85 centenary open 5 groups');
    expect(result).toBeNull();
  });

  it('derives from the markdown fallback set during a CRM outage', async () => {
    getLivePropertyDataMock.mockResolvedValue({
      properties: [property('85-centenary', '85 Centenary Boulevard, Officer South VIC 3809')],
      source: 'markdown-fallback',
      crmError: 'timeout',
    });
    const result = await resolveProperty('85 centenary open 5 groups');
    expect(result?.slug).toBe('85-centenary');
  });
});
