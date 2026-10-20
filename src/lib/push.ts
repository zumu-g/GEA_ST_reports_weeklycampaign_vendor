import { getStorage } from './storage';
import { assertSafeSlug } from './markdown-loader';

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  subscribedAt: string;
}

export async function readPushSubscriptions(slug: string): Promise<PushSubscription[]> {
  return getStorage().readList<PushSubscription>(`${slug}/push.json`);
}

export async function savePushSubscription(slug: string, sub: Omit<PushSubscription, 'subscribedAt'>): Promise<void> {
  assertSafeSlug(slug);
  const items = await readPushSubscriptions(slug);
  const filtered = items.filter(s => s.endpoint !== sub.endpoint);
  filtered.push({ ...sub, subscribedAt: new Date().toISOString() });
  await getStorage().writeList(`${slug}/push.json`, filtered);
}

export async function removePushSubscription(slug: string, endpoint: string): Promise<void> {
  assertSafeSlug(slug);
  const items = await readPushSubscriptions(slug);
  const filtered = items.filter(s => s.endpoint !== endpoint);
  if (filtered.length !== items.length) {
    await getStorage().writeList(`${slug}/push.json`, filtered);
  }
}
