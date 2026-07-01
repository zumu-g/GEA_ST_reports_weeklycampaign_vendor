import { describe, it, expect } from 'vitest';
import { assertSafeSlug } from './markdown-loader';

describe('assertSafeSlug', () => {
  it('accepts valid property slugs', () => {
    for (const s of ['85-centenary-blvd-officer-south', '14-hartsmere-dr-berwick', 'a', 'abc123']) {
      expect(assertSafeSlug(s)).toBe(s);
    }
  });

  it('rejects path traversal and separators', () => {
    for (const bad of [
      '../../etc/passwd',
      '..',
      'a/b',
      'a\\b',
      'foo/../bar',
      '/abs',
      '85_centenary',     // underscore not allowed
      'Foo',              // uppercase not allowed
      '-leading',         // must start alphanumeric
      '',
      'has space',
    ]) {
      expect(() => assertSafeSlug(bad)).toThrow(/Invalid property slug/);
    }
  });
});
