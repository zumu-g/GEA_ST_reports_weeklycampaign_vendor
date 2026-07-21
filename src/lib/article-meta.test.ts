import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchArticleMeta } from './article-meta';

const origFetch = global.fetch;
afterEach(() => {
  global.fetch = origFetch;
});

describe('fetchArticleMeta', () => {
  it('extracts title and og:description', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<html><head><title>Three graphs that show uncertainty</title>' +
        '<meta property="og:description" content="Global instability &amp; tax changes force buyers to adjust."></head></html>',
    }) as unknown as typeof fetch;

    expect(await fetchArticleMeta('https://example.com/a')).toEqual({
      title: 'Three graphs that show uncertainty',
      note: 'Global instability & tax changes force buyers to adjust.',
    });
  });

  it('falls back to empty note when no description meta exists', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><head><title>Some Article</title></head></html>',
    }) as unknown as typeof fetch;

    expect(await fetchArticleMeta('https://example.com/a')).toEqual({ title: 'Some Article', note: '' });
  });

  it('returns null on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    expect(await fetchArticleMeta('https://example.com/a')).toBeNull();
  });

  it('returns null on non-200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await fetchArticleMeta('https://example.com/a')).toBeNull();
  });
});
