import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPropertyDetails } from './everypropertyai';

const origKey = process.env.EVERYPROPERTY_API_KEY;

beforeEach(() => {
  process.env.EVERYPROPERTY_API_KEY = 'test-key';
});

afterEach(() => {
  process.env.EVERYPROPERTY_API_KEY = origKey;
  vi.unstubAllGlobals();
});

describe('getPropertyDetails', () => {
  it('returns parsed details on a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bedrooms: 4, bathrooms: 2, carSpaces: 2, landAreaSqm: 600, propertyType: 'House' }),
    }));

    const result = await getPropertyDetails('85 Centenary Boulevard, Officer South VIC 3809');
    expect(result).toEqual({ bedrooms: 4, bathrooms: 2, carSpaces: 2, landAreaSqm: 600, propertyType: 'House' });
  });

  it('fails soft to empty details on a non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await getPropertyDetails('some address');
    expect(result.bedrooms).toBeNull();
  });

  it('fails soft to empty details on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await getPropertyDetails('some address');
    expect(result).toEqual({ bedrooms: null, bathrooms: null, carSpaces: null, landAreaSqm: null, propertyType: null });
  });

  it('returns empty details when no API key is configured', async () => {
    delete process.env.EVERYPROPERTY_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await getPropertyDetails('some address');
    expect(result.bedrooms).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
