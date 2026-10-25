import { describe, it, expect } from 'vitest';
import {
  getPropertySlugForToken,
  getTokenForSlug,
  getTokenMeta,
  getAllTokens,
  generateToken,
  resolveVendorToken,
} from '@/lib/vendor-tokens';

// These read the committed src/lib/vendor-tokens.json (read-only helpers).
// We assert against known seeded tokens, not write paths.

describe('getPropertySlugForToken', () => {
  it('resolves a valid token to its property slug', () => {
    expect(getPropertySlugForToken('k7mP2xQn9rLs')).toBe('85-centenary-blvd-officer-south');
    expect(getPropertySlugForToken('rcRKLnzG5ktn')).toBe('17-juliet-gardens-pakenham');
  });

  it('returns null for an unknown token', () => {
    expect(getPropertySlugForToken('not-a-real-token')).toBeNull();
    expect(getPropertySlugForToken('')).toBeNull();
  });
});

describe('getTokenForSlug', () => {
  it('finds the token for a known slug', () => {
    expect(getTokenForSlug('14-hartsmere-dr-berwick')).toBe('wB4hJ8fZt3Yd');
  });

  it('round-trips token -> slug -> token', () => {
    const slug = getPropertySlugForToken('nC6vR1eA5gXp');
    expect(slug).toBe('9-calibar-ct-clyde-north');
    expect(getTokenForSlug(slug as string)).toBe('nC6vR1eA5gXp');
  });

  it('returns null for an unknown slug', () => {
    expect(getTokenForSlug('99-nowhere-st-narnia')).toBeNull();
  });
});

describe('getTokenMeta', () => {
  it('returns stored metadata for a token that has it', () => {
    expect(getTokenMeta('rcRKLnzG5ktn').ownerName).toBe('Lynn');
  });

  it('returns an empty object for a token with no metadata', () => {
    expect(getTokenMeta('k7mP2xQn9rLs')).toEqual({});
    expect(getTokenMeta('unknown')).toEqual({});
  });
});

describe('getAllTokens', () => {
  it('includes all seeded tokens mapped to slugs', () => {
    const all = getAllTokens();
    expect(all['k7mP2xQn9rLs']).toBe('85-centenary-blvd-officer-south');
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(4);
  });
});

describe('resolveVendorToken', () => {
  it('resolves a valid token to slug and meta in one read', () => {
    const resolved = resolveVendorToken('rcRKLnzG5ktn');
    expect(resolved?.slug).toBe('17-juliet-gardens-pakenham');
    expect(resolved?.meta.ownerName).toBe('Lynn');
  });

  it('returns an empty meta object for a token with no stored meta', () => {
    const resolved = resolveVendorToken('k7mP2xQn9rLs');
    expect(resolved?.slug).toBe('85-centenary-blvd-officer-south');
    expect(resolved?.meta).toEqual({});
  });

  it('returns null for an unknown token', () => {
    expect(resolveVendorToken('not-a-real-token')).toBeNull();
    expect(resolveVendorToken('')).toBeNull();
  });
});

describe('generateToken', () => {
  it('produces a 12-char url-safe token', () => {
    const t = generateToken();
    expect(t).toHaveLength(12);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateToken()).not.toBe(t);
  });
});

describe('VENDOR_TOKENS_FILE override', () => {
  it('reads the store from the path in VENDOR_TOKENS_FILE', async () => {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gea-tokens-')), 'tokens.json');
    fs.writeFileSync(file, JSON.stringify({ tokens: { abc: 'test-slug' }, meta: {} }));
    process.env.VENDOR_TOKENS_FILE = file;
    try {
      expect(resolveVendorToken('abc')?.slug).toBe('test-slug');
      expect(resolveVendorToken('k7mP2xQn9rLs')).toBeNull();
    } finally {
      delete process.env.VENDOR_TOKENS_FILE;
    }
  });
});
