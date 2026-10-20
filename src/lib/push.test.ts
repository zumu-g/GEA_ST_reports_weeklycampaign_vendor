import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { savePushSubscription, readPushSubscriptions, removePushSubscription } from './push';

const SLUG = 'test-push-slug';
const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-push-'));
  process.env.PROPERTIES_DIR = tmp;
});
afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('savePushSubscription', () => {
  it('stores a subscription and does not duplicate a second save of the same endpoint', async () => {
    await savePushSubscription(SLUG, { endpoint: 'https://push/1', keys: { p256dh: 'a', auth: 'b' } });
    await savePushSubscription(SLUG, { endpoint: 'https://push/1', keys: { p256dh: 'c', auth: 'd' } });
    const subs = await readPushSubscriptions(SLUG);
    expect(subs).toHaveLength(1);
    expect(subs[0].keys.p256dh).toBe('c');
  });
});

describe('removePushSubscription', () => {
  it('removes a subscription by endpoint', async () => {
    await savePushSubscription(SLUG, { endpoint: 'https://push/1', keys: { p256dh: 'a', auth: 'b' } });
    await removePushSubscription(SLUG, 'https://push/1');
    expect(await readPushSubscriptions(SLUG)).toHaveLength(0);
  });
});
