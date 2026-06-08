import crypto from 'crypto';
import path from 'path';

// Document hub helpers: upload validation + a dependency-free, store-only ZIP
// builder for the "download all" action. Kept separate from markdown-loader so
// the security boundary (validation) is easy to find and reason about.

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB

// MIME allowlist. Vendor uploads are untrusted input — only these are accepted.
export const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
};

export interface ValidationOk {
  ok: true;
  ext: string;
}
export interface ValidationErr {
  ok: false;
  status: number;
  error: string;
}
export type ValidationResult = ValidationOk | ValidationErr;

export function validateUpload(mime: string, size: number): ValidationResult {
  if (!size || size <= 0) {
    return { ok: false, status: 400, error: 'Empty file' };
  }
  if (size > MAX_DOCUMENT_BYTES) {
    return { ok: false, status: 400, error: 'File exceeds 25 MB limit' };
  }
  const ext = ALLOWED_MIME[mime];
  if (!ext) {
    return { ok: false, status: 400, error: `Unsupported file type: ${mime || 'unknown'}` };
  }
  return { ok: true, ext };
}

// Display-only sanitisation of the original filename. The on-disk name is
// always a generated storedName (see generateStoredName), so this never
// influences a filesystem path — it only protects what we store/show.
export function sanitiseFilename(name: string): string {
  const base = path.basename(name || 'document');
  const cleaned = base.replace(/[^a-zA-Z0-9._ -]+/g, '_').replace(/_{2,}/g, '_').trim();
  return cleaned.slice(0, 120) || 'document';
}

// Random on-disk name; never derived from client input. Prevents path traversal
// and collisions.
export function generateStoredName(ext: string): string {
  return `${crypto.randomUUID()}.${ext}`;
}

// --- Store-only ZIP (no compression). Sufficient for small per-property sets. ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Buffer;
}

export function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf-8');
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 filename
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    localParts.push(local, nameBuf, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central dir header signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + entry.data.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const localBuf = Buffer.concat(localParts);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // EOCD signature
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // central dir disk
  end.writeUInt16LE(entries.length, 8); // entries on this disk
  end.writeUInt16LE(entries.length, 10); // total entries
  end.writeUInt32LE(centralBuf.length, 12); // central dir size
  end.writeUInt32LE(localBuf.length, 16); // central dir offset
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localBuf, centralBuf, end]);
}
