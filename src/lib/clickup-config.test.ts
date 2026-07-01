import { describe, it, expect } from 'vitest';
import { getSlugForListId, CLICKUP_LIST_IDS } from '@/lib/clickup-config';

describe('getSlugForListId', () => {
  it('maps a known list id to its slug', () => {
    expect(getSlugForListId('901611120989')).toBe('85-centenary-blvd-officer-south');
    expect(getSlugForListId('901612396080')).toBe('14-hartsmere-dr-berwick');
  });

  it('returns null for an unmapped list id', () => {
    expect(getSlugForListId('000000000000')).toBeNull();
    expect(getSlugForListId('')).toBeNull();
  });

  it('does not loosely match a partial id', () => {
    expect(getSlugForListId('9016111209')).toBeNull();
  });

  it('every configured list id round-trips back to its slug', () => {
    for (const [slug, id] of Object.entries(CLICKUP_LIST_IDS)) {
      expect(getSlugForListId(id)).toBe(slug);
    }
  });
});
