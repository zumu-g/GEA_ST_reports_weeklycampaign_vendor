import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { dispatchNotifications } from './dispatch-notifications';

const origPropertiesDir = process.env.PROPERTIES_DIR;
const origResendKey = process.env.RESEND_API_KEY;
let tmp: string;
let outboundDir: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-dispatch-'));
  process.env.PROPERTIES_DIR = tmp;
  process.env.RESEND_API_KEY = 'test-resend-key';
  outboundDir = path.join(tmp, '_outbound');
  await fs.mkdir(outboundDir, { recursive: true });
});

afterEach(async () => {
  process.env.PROPERTIES_DIR = origPropertiesDir;
  process.env.RESEND_API_KEY = origResendKey;
  vi.unstubAllGlobals();
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writeQueueItem(id: string, overrides: Record<string, unknown> = {}) {
  const item = {
    id,
    channel: 'email',
    to: { email: 'vendor@example.com' },
    vendor: 'Test Vendor',
    subject: 'Update',
    body: 'Hello',
    portalUrl: 'https://portal.example.com/vendor/x',
    created_at: new Date().toISOString(),
    ...overrides,
  };
  await fs.writeFile(path.join(outboundDir, `${id}.json`), JSON.stringify(item, null, 2), 'utf-8');
}

describe('dispatchNotifications', () => {
  it('sends a queued email and archives it to sent/', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' }));
    await writeQueueItem('item-1');

    const result = await dispatchNotifications();
    expect(result).toEqual({ total: 1, sent: 1, failed: [] });

    const sentFiles = await fs.readdir(path.join(outboundDir, 'sent'));
    expect(sentFiles).toContain('item-1.json');
    const queueFiles = await fs.readdir(outboundDir);
    expect(queueFiles).not.toContain('item-1.json');
  });

  it('leaves the item in place with incremented attempts on failure below MAX_ATTEMPTS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));
    await writeQueueItem('item-2');

    const result = await dispatchNotifications();
    expect(result).toEqual({ total: 1, sent: 0, failed: ['item-2.json'] });

    const stillQueued = JSON.parse(await fs.readFile(path.join(outboundDir, 'item-2.json'), 'utf-8'));
    expect(stillQueued._attempts).toBe(1);

    const failedFiles = await fs.readdir(path.join(outboundDir, 'failed')).catch(() => []);
    expect(failedFiles).not.toContain('item-2.json');
  });

  it('moves to failed/ after MAX_ATTEMPTS is reached', async () => {
    process.env.MAX_ATTEMPTS = '1';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));
    await writeQueueItem('item-3');

    await dispatchNotifications();
    const failedFiles = await fs.readdir(path.join(outboundDir, 'failed'));
    expect(failedFiles).toContain('item-3.json');
    delete process.env.MAX_ATTEMPTS;
  });

  it('ignores files starting with underscore', async () => {
    await fs.writeFile(path.join(outboundDir, '_EXAMPLE.json'), '{}', 'utf-8');
    const result = await dispatchNotifications();
    expect(result.total).toBe(0);
  });

  it('returns zero counts for an empty queue', async () => {
    const result = await dispatchNotifications();
    expect(result).toEqual({ total: 0, sent: 0, failed: [] });
  });
});
