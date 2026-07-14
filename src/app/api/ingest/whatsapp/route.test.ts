import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { POST } from './route';
import { computeTwilioSignature, signedUrlForPath } from '@/lib/twilio-signature';
import { readActivity } from '@/lib/markdown-loader';

const SLUG = '85-centenary-blvd-officer-south';
const FROM = '+61400111222';
const TOKEN = 'test-twilio-token';

const origPropertiesDir = process.env.PROPERTIES_DIR;
const origAuthToken = process.env.TWILIO_AUTH_TOKEN;
const origAllowed = process.env.WHATSAPP_ALLOWED_SENDERS;
const origBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-whatsapp-'));
  process.env.PROPERTIES_DIR = tmp;
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
  process.env.WHATSAPP_ALLOWED_SENDERS = FROM;
  process.env.NEXT_PUBLIC_BASE_URL = 'https://portal.grantsea.com.au';
  await fs.mkdir(path.join(tmp, SLUG), { recursive: true });
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origPropertiesDir;
  process.env.TWILIO_AUTH_TOKEN = origAuthToken;
  process.env.WHATSAPP_ALLOWED_SENDERS = origAllowed;
  process.env.NEXT_PUBLIC_BASE_URL = origBaseUrl;
  vi.unstubAllEnvs();
  await fs.rm(tmp, { recursive: true, force: true });
});

function buildRequest(params: Record<string, string>, opts: { signed?: boolean } = { signed: true }) {
  const url = signedUrlForPath('/api/ingest/whatsapp');
  const body = new URLSearchParams(params).toString();
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (opts.signed !== false) {
    headers['x-twilio-signature'] = computeTwilioSignature(TOKEN, url, params);
  }
  return new NextRequest(url, { method: 'POST', headers, body });
}

describe('POST /api/ingest/whatsapp', () => {
  it('writes an activity entry with source whatsapp for an allowlisted sender + valid signature', async () => {
    const params = { Body: '85 Centenary | note: buyer called', From: FROM };
    const res = await POST(buildRequest(params));
    expect(res.status).toBe(200);
    const activity = await readActivity(SLUG);
    expect(activity).toHaveLength(1);
    expect(activity[0].source).toBe('whatsapp');
    expect(activity[0].summary).toBe('buyer called');
  });

  it('writes an inspection file for shorthand body', async () => {
    const params = { Body: '85 Centenary | open | 3 groups | 1 interested | keen', From: FROM };
    const res = await POST(buildRequest(params));
    expect(res.status).toBe(200);
    const files = await fs.readdir(path.join(tmp, SLUG, 'inspections'));
    expect(files.length).toBeGreaterThan(0);
  });

  it('does not write anything for an unmatched property', async () => {
    const params = { Body: 'Nonexistent Street | note: hello', From: FROM };
    const res = await POST(buildRequest(params));
    expect(res.status).toBe(200);
    const activity = await readActivity(SLUG);
    expect(activity).toHaveLength(0);
  });

  it('rejects an unallowlisted sender even with a valid signature', async () => {
    const params = { Body: '85 Centenary | note: hi', From: '+61499999999' };
    const res = await POST(buildRequest(params));
    expect(res.status).toBe(200); // unmatched-shaped 200, no retry
    const activity = await readActivity(SLUG);
    expect(activity).toHaveLength(0);
  });

  it('rejects an invalid signature', async () => {
    const params = { Body: '85 Centenary | note: hi', From: FROM };
    const req = buildRequest(params);
    // Tamper with the signature header
    const tampered = new NextRequest(req.url, {
      method: 'POST',
      headers: { ...Object.fromEntries(req.headers), 'x-twilio-signature': 'invalid' },
      body: new URLSearchParams(params).toString(),
    });
    const res = await POST(tampered);
    expect(res.status).toBe(403);
  });

  it('returns 503 when TWILIO_AUTH_TOKEN is unset in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.TWILIO_AUTH_TOKEN;
    const res = await POST(buildRequest({ Body: 'x', From: FROM }, { signed: false }));
    expect(res.status).toBe(503);
  });
});
