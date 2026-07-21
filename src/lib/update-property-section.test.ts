import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { updatePropertySection } from './markdown-loader';

const SLUG = 'test-slug';
const HEADER = '| Address | Price | Type | Date | Beds | Baths | Cars |';

const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-section-'));
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

describe('updatePropertySection', () => {
  it('replaces an empty table under an existing heading', async () => {
    await writeFixture(`# 1 Test St\n\n## Just Listed Nearby\n${HEADER}\n|---------|-------|------|------|------|-------|------|\n|         |       |      |      |      |       |      |\n\n## Weekly Targets\n- x\n`);

    await updatePropertySection(SLUG, 'Just Listed Nearby', HEADER, [
      ['3 Real St', '$700k', 'House', '2026-01-01', '4', '2', '2'],
    ]);

    const result = await readResult();
    expect(result).toContain('| 3 Real St | $700k | House | 2026-01-01 | 4 | 2 | 2 |');
    expect(result).toContain('## Weekly Targets'); // next section untouched
    expect(result).toContain('- x');
  });

  it('appends the heading + table when missing entirely', async () => {
    await writeFixture('# 1 Test St\n\n## Property Details\n- **Owner:** Someone\n');

    await updatePropertySection(SLUG, 'Just Sold Nearby', HEADER, [
      ['5 Real St', '$650k', 'House', '2025-12-01', '3', '1', '1'],
    ]);

    const result = await readResult();
    expect(result).toContain('## Just Sold Nearby');
    expect(result).toContain('| 5 Real St | $650k | House | 2025-12-01 | 3 | 1 | 1 |');
  });

  it('writes an honest empty-state row when there are no rows', async () => {
    await writeFixture(`# 1 Test St\n\n## Just Listed Nearby\n${HEADER}\n|---------|-------|------|------|------|-------|------|\n|         |       |      |      |      |       |      |\n`);

    await updatePropertySection(SLUG, 'Just Listed Nearby', HEADER, []);

    const result = await readResult();
    expect(result).toContain('No recent nearby activity');
  });

  it('escapes hostile cell values so they render inert', async () => {
    await writeFixture(`# 1 Test St\n\n## Just Listed Nearby\n${HEADER}\n|---------|-------|------|------|------|-------|------|\n`);

    await updatePropertySection(SLUG, 'Just Listed Nearby', HEADER, [
      ['Evil | injected <script>row</script>\nbreak', '$1', 'House', '2026-01-01', '1', '1', '1'],
    ]);

    const result = await readResult();
    // The pipe and newline that would break the table structure are gone,
    // and angle brackets are escaped so they can't inject markup.
    expect(result).not.toMatch(/Evil \| injected/);
    expect(result).toContain('&lt;script&gt;');
  });

  it('does nothing when the property file does not exist', async () => {
    await expect(updatePropertySection('nonexistent-slug', 'Just Listed Nearby', HEADER, [])).resolves.toBeUndefined();
  });
});
