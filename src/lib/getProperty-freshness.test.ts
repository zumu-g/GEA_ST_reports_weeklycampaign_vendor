import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getProperty } from './markdown-loader';

// Pins the "auto-rebuild" behaviour: markdown edits must be visible on the
// very next getProperty() call, with no caching layer to invalidate.
const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-freshness-'));
  process.env.PROPERTIES_DIR = tmp;
  await fs.mkdir(path.join(tmp, 'test-slug'), { recursive: true });
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('getProperty freshness (no caching between edits)', () => {
  it('reflects a markdown edit on the very next call', async () => {
    const file = path.join(tmp, 'test-slug', 'PROPERTY.md');
    await fs.writeFile(
      file,
      '# Test Address\n\n## Property Details\n- **Owner:** Original Owner\n',
      'utf-8'
    );

    const before = await getProperty('test-slug');
    expect(before?.owner).toBe('Original Owner');

    await fs.writeFile(
      file,
      '# Test Address\n\n## Property Details\n- **Owner:** Updated Owner\n',
      'utf-8'
    );

    const after = await getProperty('test-slug');
    expect(after?.owner).toBe('Updated Owner');
  });
});
