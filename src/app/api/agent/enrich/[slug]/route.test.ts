import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const getVendorReportComps = vi.fn();
vi.mock('@/lib/everypropertyai', () => ({
  getVendorReportComps: (...args: unknown[]) => getVendorReportComps(...args),
}));

import { POST } from './route';
import { readActivity } from '@/lib/markdown-loader';

const SLUG = 'enrich-test-slug';
const AGENT_KEY = 'test-agent-key';
const origPropertiesDir = process.env.PROPERTIES_DIR;
const origAgentKey = process.env.AGENT_API_KEY;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-enrich-'));
  process.env.PROPERTIES_DIR = tmp;
  process.env.AGENT_API_KEY = AGENT_KEY;
  getVendorReportComps.mockReset();

  await fs.mkdir(path.join(tmp, SLUG), { recursive: true });
  await fs.writeFile(
    path.join(tmp, SLUG, 'PROPERTY.md'),
    `# 1 Test Street, Testville VIC 3000

## Property Details
- **Owner:** Test Owner

## Just Listed Nearby
| Address | Price | Type | Date | Beds | Baths | Cars |
|---------|-------|------|------|------|-------|------|
|         |       |      |      |      |       |      |

## Just Sold Nearby
| Address | Price | Type | Date | Beds | Baths | Cars |
|---------|-------|------|------|------|-------|------|
|         |       |      |      |      |       |      |
`,
    'utf-8'
  );
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origPropertiesDir;
  process.env.AGENT_API_KEY = origAgentKey;
  await fs.rm(tmp, { recursive: true, force: true });
});

function req(headers: Record<string, string> = { 'x-agent-key': AGENT_KEY }) {
  return new NextRequest('http://localhost/api/agent/enrich/' + SLUG, { method: 'POST', headers });
}

describe('POST /api/agent/enrich/[slug]', () => {
  it('rewrites both nearby tables and logs an enrichment activity entry', async () => {
    getVendorReportComps.mockResolvedValue({
      solds: [{ rawAddress: '3 Real St', salePrice: 650000, propertyType: 'House', saleDate: '2026-01-01', suburb: null, postcode: null, landAreaSqm: null, latitude: null, longitude: null, agencyName: null, agentName: null, listingUrl: null, imageUrl: null, distanceMetres: null }],
      listings: [{ rawAddress: '5 Real St', displayPrice: '$700k+', propertyType: 'House', bedrooms: 4, bathrooms: 2, carSpaces: 2, suburb: null, postcode: null, priceLow: null, priceHigh: null, status: null, landAreaSqm: null, latitude: null, longitude: null, agencyName: null, agentName: null, listingUrl: null, imageUrl: null, distanceMetres: null }],
    });

    const res = await POST(req(), { params: Promise.resolve({ slug: SLUG }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, listingsFound: 1, soldsFound: 1 });

    const content = await fs.readFile(path.join(tmp, SLUG, 'PROPERTY.md'), 'utf-8');
    expect(content).toContain('5 Real St');
    expect(content).toContain('3 Real St');

    const activity = await readActivity(SLUG);
    expect(activity).toHaveLength(1);
    expect(activity[0].source).toBe('enrichment');
  });

  it('writes an honest empty-state when the backend returns no comps', async () => {
    getVendorReportComps.mockResolvedValue({ solds: [], listings: [] });
    const res = await POST(req(), { params: Promise.resolve({ slug: SLUG }) });
    expect(res.status).toBe(200);
    const content = await fs.readFile(path.join(tmp, SLUG, 'PROPERTY.md'), 'utf-8');
    expect(content).toContain('No recent nearby activity');
  });

  it('returns 401 without a valid agent key', async () => {
    const res = await POST(req({}), { params: Promise.resolve({ slug: SLUG }) });
    expect(res.status).toBe(401);
    expect(getVendorReportComps).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown property', async () => {
    const res = await POST(req(), { params: Promise.resolve({ slug: 'nonexistent-slug' }) });
    expect(res.status).toBe(404);
  });

  it('returns 502 and leaves PROPERTY.md unchanged when the client throws', async () => {
    getVendorReportComps.mockRejectedValue(new Error('boom'));
    const before = await fs.readFile(path.join(tmp, SLUG, 'PROPERTY.md'), 'utf-8');
    const res = await POST(req(), { params: Promise.resolve({ slug: SLUG }) });
    expect(res.status).toBe(502);
    const after = await fs.readFile(path.join(tmp, SLUG, 'PROPERTY.md'), 'utf-8');
    expect(after).toBe(before);
  });
});
