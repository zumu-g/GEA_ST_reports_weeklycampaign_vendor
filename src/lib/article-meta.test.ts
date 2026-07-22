import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
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

  it('collapses a multi-line title/description to a single line', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<html><head><title>Line one\nLine two</title>' +
        '<meta property="og:description" content="Summary\nwith a break."></head></html>',
    }) as unknown as typeof fetch;

    expect(await fetchArticleMeta('https://example.com/a')).toEqual({
      title: 'Line one Line two',
      note: 'Summary with a break.',
    });
  });

  describe('SSRF guard', () => {
    const fetchSpy = vi.fn();
    beforeEach(() => {
      global.fetch = fetchSpy as unknown as typeof fetch;
      fetchSpy.mockClear();
    });

    it.each([
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:3000/secret',
      'http://127.0.0.1/x',
      'http://10.0.0.5/x',
      'http://192.168.1.1/x',
      'file:///etc/passwd',
      'ftp://example.com/a',
    ])('rejects %s without calling fetch', async (url) => {
      expect(await fetchArticleMeta(url)).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('allows a normal public https URL through to fetch', async () => {
      fetchSpy.mockResolvedValue({ ok: true, text: async () => '<title>Public Article</title>' });
      expect(await fetchArticleMeta('https://example.com/a')).toEqual({ title: 'Public Article', note: '' });
      expect(fetchSpy).toHaveBeenCalledOnce();
    });
  });
});
