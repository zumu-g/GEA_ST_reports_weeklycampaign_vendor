import fs from 'fs/promises';
import path from 'path';

// Storage seam for write-heavy, append-only JSON (activity/comments sidecars
// and the notification outbound queue). Markdown source-of-truth stays on the
// filesystem; only these mutable lists move, because Vercel's runtime FS is
// read-only and would reject the writes.
//
// A "key" is the sidecar's logical path, e.g. "85-centenary/activity.json" or
// "_outbound/1699-abc.json". Drivers decide how to persist it.
export interface StorageDriver {
  readList<T>(key: string): Promise<T[]>;
  writeList<T>(key: string, items: T[]): Promise<void>;
}

// Read per-call (not at module load) so PROPERTIES_DIR overrides — in tests or
// a late-configured deploy — take effect.
function propertiesDir(): string {
  return (
    process.env.PROPERTIES_DIR ||
    '/Users/stuartgrant_mbp13/Library/Mobile Documents/com~apple~CloudDocs/GEA_vendor_portal/properties'
  );
}

// Filesystem driver — the current (and default) behaviour, byte-for-byte:
// pretty-printed JSON with a trailing newline, missing file → [].
const fsDriver: StorageDriver = {
  async readList<T>(key: string): Promise<T[]> {
    const filePath = path.join(propertiesDir(), key);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  async writeList<T>(key: string, items: T[]): Promise<void> {
    const filePath = path.join(propertiesDir(), key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(items, null, 2) + '\n', 'utf-8');
  },
};

// KV driver — for Vercel's read-only FS. Not yet wired: it needs the
// `@vercel/kv` (or Upstash) client and a live instance, which can't be
// exercised locally. Fails loudly and actionably rather than silently.
// To implement: `npm i @vercel/kv`, then back readList/writeList with
// `kv.get(key)` / `kv.set(key, items)`.
const KV_NOT_IMPLEMENTED =
  'STORAGE_DRIVER=kv is not yet implemented. Install @vercel/kv and back src/lib/storage.ts kvDriver with it.';

const kvDriver: StorageDriver = {
  async readList<T>(_key: string): Promise<T[]> {
    void _key;
    throw new Error(KV_NOT_IMPLEMENTED);
  },
  async writeList<T>(_key: string, _items: T[]): Promise<void> {
    void _key;
    void _items;
    throw new Error(KV_NOT_IMPLEMENTED);
  },
};

export function getStorage(): StorageDriver {
  return process.env.STORAGE_DRIVER === 'kv' ? kvDriver : fsDriver;
}
