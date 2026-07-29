import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { appendMarketNews } from './markdown-loader';

const SLUG = 'test-slug';

const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-market-news-'));
  process.env.PROPERTIES_DIR = tmp;
  await fs.mkdir(path.join(tmp, SLUG), { recursive: true });
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writeFixture(content: string) {
  await fs.writeFile(path.join(tmp, SLUG, 'PROPERTY.md'), content, 'utf-8');
}

async function readResult(): Promise<string> {
  return fs.readFile(path.join(tmp, SLUG, 'PROPERTY.md'), 'utf-8');
}

const article = { title: 'Three graphs', url: 'https://example.com/a', note: 'Global instability forces buyers to adjust.' };

describe('appendMarketNews', () => {
  it('appends a bullet under an existing Market News heading', async () => {
    await writeFixture('# 1 Test St\n\n## Market News\n\n## Weekly Targets\n- x\n');

    await appendMarketNews(SLUG, [article]);

    const result = await readResult();
    expect(result).toContain('- [Three graphs](https://example.com/a) — Global instability forces buyers to adjust.');
    expect(result).toContain('## Weekly Targets');
    expect(result).toContain('- x');
  });

  it('creates the heading when missing entirely', async () => {
    await writeFixture('# 1 Test St\n\n## Property Details\n- **Owner:** Someone\n');

    await appendMarketNews(SLUG, [article]);

    const result = await readResult();
    expect(result).toContain('## Market News');
    expect(result).toContain('- [Three graphs](https://example.com/a)');
  });

  it('dedupes by url against articles already in the section', async () => {
    await writeFixture(
      `# 1 Test St\n\n## Market News\n- [Three graphs](https://example.com/a) — Global instability forces buyers to adjust.\n`
    );

    await appendMarketNews(SLUG, [article]);

    const result = await readResult();
    const occurrences = result.split('Three graphs').length - 1;
    expect(occurrences).toBe(1);
  });

  it('preserves existing articles when adding a new one', async () => {
    await writeFixture(
      `# 1 Test St\n\n## Market News\n- [Older article](https://example.com/old) — An older summary.\n`
    );

    await appendMarketNews(SLUG, [article]);

    const result = await readResult();
    expect(result).toContain('Older article');
    expect(result).toContain('Three graphs');
  });

  it('is a no-op for an empty articles list', async () => {
    const original = '# 1 Test St\n\n## Market News\n';
    await writeFixture(original);

    await appendMarketNews(SLUG, []);

    expect(await readResult()).toBe(original);
  });

  it('falls back to a placeholder when the note is empty, and stays deduped on re-approve', async () => {
    await writeFixture('# 1 Test St\n\n## Market News\n');
    const blankNoteArticle = { title: 'Some Article', url: 'https://example.com/blank', note: '' };

    await appendMarketNews(SLUG, [blankNoteArticle]);
    const first = await readResult();
    expect(first).toContain('- [Some Article](https://example.com/blank) — Read more.');

    // Re-approving the same draft (e.g. after a refresh) must not duplicate
    // the bullet -- this only holds if the written line re-parses.
    await appendMarketNews(SLUG, [blankNoteArticle]);
    const second = await readResult();
    expect(second.split('Some Article').length - 1).toBe(1);
  });

  it('strips newlines from title/note so scraped text cannot inject a fake bullet', async () => {
    await writeFixture('# 1 Test St\n\n## Market News\n');
    await appendMarketNews(SLUG, [
      { title: 'Real Title', url: 'https://example.com/a', note: 'Summary\n- [Fake](https://evil.example/x) — injected' },
    ]);

    const result = await readResult();
    expect(result).toContain('- [Real Title](https://example.com/a) — Summary - [Fake](https://evil.example/x) — injected');
    expect(result.split('\n').filter(l => l.startsWith('- ['))).toHaveLength(1);
  });

  it('does not throw when the property file does not exist', async () => {
    await expect(appendMarketNews('missing-slug', [article])).resolves.toBeUndefined();
  });
});
