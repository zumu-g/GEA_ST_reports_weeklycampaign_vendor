import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const broadcastArticleToAllDrafts = vi.fn();
const getReportWeekEnding = vi.fn().mockReturnValue('2026-07-19');
const fetchArticleMeta = vi.fn();
const appendActivity = vi.fn();
const writeInspectionFile = vi.fn();
const resolveProperty = vi.fn();
const upsertBuyer = vi.fn();

vi.mock('@/lib/buyers', () => ({
  upsertBuyer: (...args: unknown[]) => upsertBuyer(...args),
}));
vi.mock('@/lib/weekly-drafts', () => ({
  broadcastArticleToAllDrafts: (...args: unknown[]) => broadcastArticleToAllDrafts(...args),
  getReportWeekEnding: (...args: unknown[]) => getReportWeekEnding(...args),
}));
vi.mock('@/lib/article-meta', () => ({
  fetchArticleMeta: (...args: unknown[]) => fetchArticleMeta(...args),
}));
vi.mock('@/lib/markdown-loader', () => ({
  appendActivity: (...args: unknown[]) => appendActivity(...args),
  writeInspectionFile: (...args: unknown[]) => writeInspectionFile(...args),
}));
vi.mock('@/lib/property-registry', () => ({
  resolveProperty: (...args: unknown[]) => resolveProperty(...args),
}));

import { POST } from './route';

const origKey = process.env.INGEST_API_KEY;
afterEach(() => {
  process.env.INGEST_API_KEY = origKey;
  vi.clearAllMocks();
});

function req(body: object, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/ingest/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ingest-key': 'secret', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ingest/telegram — article broadcast', () => {
  it('broadcasts an article with inline title/summary to all drafts', async () => {
    process.env.INGEST_API_KEY = 'secret';
    broadcastArticleToAllDrafts.mockResolvedValue({ updated: ['a', 'b'], skipped: [] });

    const message =
      'Add this article link and summary to all property reports this week\n' +
      'https://www.abc.net.au/news/a\nThree graphs\nGlobal instability forces buyers to adjust.';

    const res = await POST(req({ message }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      kind: 'article-broadcast',
      weekEnding: '2026-07-19',
      updated: ['a', 'b'],
      skipped: [],
      article: {
        title: 'Three graphs',
        url: 'https://www.abc.net.au/news/a',
        note: 'Global instability forces buyers to adjust.',
      },
    });
    expect(fetchArticleMeta).not.toHaveBeenCalled();
  });

  it('falls back to fetchArticleMeta for a bare-URL broadcast message', async () => {
    process.env.INGEST_API_KEY = 'secret';
    fetchArticleMeta.mockResolvedValue({ title: 'Fetched Title', note: 'Fetched summary' });
    broadcastArticleToAllDrafts.mockResolvedValue({ updated: ['a'], skipped: [] });

    const res = await POST(req({ message: 'Add this article\nhttps://example.com/a' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.article).toEqual({ title: 'Fetched Title', note: 'Fetched summary', url: 'https://example.com/a' });
    expect(broadcastArticleToAllDrafts).toHaveBeenCalledWith(
      { title: 'Fetched Title', url: 'https://example.com/a', note: 'Fetched summary' },
      '2026-07-19'
    );
  });

  it('returns 422 when a bare-URL broadcast cannot be resolved to a title', async () => {
    process.env.INGEST_API_KEY = 'secret';
    fetchArticleMeta.mockResolvedValue(null);

    const res = await POST(req({ message: 'Add this article\nhttps://example.com/a' }));
    expect(res.status).toBe(422);
    expect(broadcastArticleToAllDrafts).not.toHaveBeenCalled();
  });

  it('surfaces partial failures (skipped properties) in the response', async () => {
    process.env.INGEST_API_KEY = 'secret';
    broadcastArticleToAllDrafts.mockResolvedValue({ updated: ['a'], skipped: ['b'] });

    const res = await POST(req({ message: 'Add this article\nhttps://example.com/a\nTitle\nNote' }));
    const json = await res.json();
    expect(json.updated).toEqual(['a']);
    expect(json.skipped).toEqual(['b']);
  });

  it('does not intercept a normal note that happens to contain a link', async () => {
    process.env.INGEST_API_KEY = 'secret';
    resolveProperty.mockReturnValue({ slug: 'a', address: '85 Centenary' });
    appendActivity.mockResolvedValue({ id: '1' });

    const res = await POST(req({ message: '85 Centenary | note: sent them this https://example.com/a' }));
    expect(res.status).toBe(200);
    expect(broadcastArticleToAllDrafts).not.toHaveBeenCalled();
    expect(appendActivity).toHaveBeenCalledOnce();
  });

  it('still enforces the ingest auth gate ahead of any parsing', async () => {
    process.env.INGEST_API_KEY = 'secret';
    const res = await POST(req({ message: 'Add this article\nhttps://example.com/a' }, { 'x-ingest-key': 'wrong' }));
    expect(res.status).toBe(401);
    expect(broadcastArticleToAllDrafts).not.toHaveBeenCalled();
  });
});

describe('POST /api/ingest/telegram — buyer shorthand', () => {
  it('matches the property and upserts the buyer', async () => {
    process.env.INGEST_API_KEY = 'secret';
    resolveProperty.mockReturnValue({ slug: '85-centenary', address: '85 Centenary Blvd' });
    upsertBuyer.mockResolvedValue({ id: '1', firstName: 'Priya', position: 'finance-approved', interest: 'High' });

    const res = await POST(req({ message: '85 Centenary | buyer: Priya, finance approved, high, loved the yard' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, kind: 'buyer', slug: '85-centenary' });
    expect(upsertBuyer).toHaveBeenCalledWith('85-centenary', expect.objectContaining({
      firstName: 'Priya',
      position: 'finance-approved',
      interest: 'High',
      source: 'telegram',
    }));
  });

  it('returns 404 when the property cannot be matched and does not upsert', async () => {
    process.env.INGEST_API_KEY = 'secret';
    resolveProperty.mockReturnValue(null);
    const res = await POST(req({ message: 'Nowhere St | buyer: Priya' }));
    expect(res.status).toBe(404);
    expect(upsertBuyer).not.toHaveBeenCalled();
  });
});
