import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getStorage } from './storage';

const origDir = process.env.PROPERTIES_DIR;
const origDriver = process.env.STORAGE_DRIVER;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-storage-'));
  process.env.PROPERTIES_DIR = tmp;
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  process.env.STORAGE_DRIVER = origDriver;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('fs storage driver', () => {
  it('defaults to the fs driver when STORAGE_DRIVER is unset', () => {
    delete process.env.STORAGE_DRIVER;
    // Should not throw (the kv driver throws on use).
    expect(getStorage()).toBeDefined();
  });

  it('round-trips an append-only list identically to the old sidecar format', async () => {
    delete process.env.STORAGE_DRIVER;
    const s = getStorage();
    const items = [{ id: 'a', ts: '2026-01-01' }, { id: 'b', ts: '2026-01-02' }];
    await s.writeList('85-centenary/activity.json', items);
    expect(await s.readList('85-centenary/activity.json')).toEqual(items);

    // Byte-for-byte format parity: pretty-printed with trailing newline.
    const raw = await fs.readFile(path.join(tmp, '85-centenary/activity.json'), 'utf-8');
    expect(raw).toBe(JSON.stringify(items, null, 2) + '\n');
  });

  it('returns [] for a missing sidecar', async () => {
    delete process.env.STORAGE_DRIVER;
    expect(await getStorage().readList('nope/comments.json')).toEqual([]);
  });
});

describe('kv storage driver', () => {
  it('is selected by STORAGE_DRIVER=kv and fails loudly until implemented', async () => {
    process.env.STORAGE_DRIVER = 'kv';
    await expect(getStorage().readList('x/y.json')).rejects.toThrow(/not yet implemented/);
  });
});
