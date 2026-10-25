import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Gitignored, so on Railway it must live on the volume: set VENDOR_TOKENS_FILE.
// Resolved per call so the override works in tests.
function tokensFile(): string {
  return process.env.VENDOR_TOKENS_FILE || path.join(process.cwd(), 'src/lib/vendor-tokens.json');
}

export interface TokenMeta {
  ownerName?: string;
  ownerEmail?: string;
}

interface TokenStoreFile {
  tokens: Record<string, string>;
  meta: Record<string, TokenMeta>;
}

function readStore(): TokenStoreFile {
  try {
    const raw = JSON.parse(fs.readFileSync(tokensFile(), 'utf-8'));
    // Migrate flat format (legacy: { token: slug }) to nested format
    if (!raw.tokens) {
      return { tokens: raw as Record<string, string>, meta: {} };
    }
    return { tokens: raw.tokens ?? {}, meta: raw.meta ?? {} };
  } catch {
    return { tokens: {}, meta: {} };
  }
}

function writeStore(store: TokenStoreFile): void {
  fs.writeFileSync(tokensFile(), JSON.stringify(store, null, 2) + '\n', 'utf-8');
}

export function getPropertySlugForToken(token: string): string | null {
  const { tokens } = readStore();
  return tokens[token] ?? null;
}

export function getTokenForSlug(slug: string): string | null {
  const { tokens } = readStore();
  const entry = Object.entries(tokens).find(([, s]) => s === slug);
  return entry ? entry[0] : null;
}

export function getTokenMeta(token: string): TokenMeta {
  const { meta } = readStore();
  return meta[token] ?? {};
}

// Resolves a vendor token to its property slug and owner meta in one read, so
// every /api/vendor/* route can refuse an unknown token before doing any work
// rather than accepting a slug or email the caller supplied directly (R12).
export function resolveVendorToken(token: string): { slug: string; meta: TokenMeta } | null {
  const { tokens, meta } = readStore();
  const slug = tokens[token];
  if (!slug) return null;
  return { slug, meta: meta[token] ?? {} };
}

export function generateToken(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

export function assignToken(slug: string, metadata?: TokenMeta): string {
  const store = readStore();
  const existing = Object.entries(store.tokens).find(([, s]) => s === slug);
  const token = existing ? existing[0] : generateToken();
  if (!existing) store.tokens[token] = slug;
  if (metadata) store.meta[token] = { ...store.meta[token], ...metadata };
  writeStore(store);
  return token;
}

export function revokeToken(token: string): void {
  const store = readStore();
  delete store.tokens[token];
  delete store.meta[token];
  writeStore(store);
}

export function getAllTokens(): Record<string, string> {
  return readStore().tokens;
}
