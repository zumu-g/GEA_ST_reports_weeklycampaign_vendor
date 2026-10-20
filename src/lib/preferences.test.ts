import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getPreferences, isAllowedNow, DEFAULT_PREFERENCES } from './preferences';

const SLUG = 'test-prefs-slug';
const origDir = process.env.PROPERTIES_DIR;
let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gea-prefs-'));
  process.env.PROPERTIES_DIR = tmp;
  await fs.mkdir(path.join(tmp, SLUG), { recursive: true });
});
afterEach(async () => {
  process.env.PROPERTIES_DIR = origDir;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('getPreferences', () => {
  it('returns defaults when no PREFERENCES.md exists', async () => {
    const prefs = await getPreferences(SLUG);
    expect(prefs.channels.push['Weekly Report']).toBe(true);
    expect(prefs.quietHours.startHour).toBe(20);
  });

  it('parses unchecked boxes and quiet hours from a real preferences file', async () => {
    await fs.writeFile(
      path.join(tmp, SLUG, 'PREFERENCES.md'),
      `## Email Notifications\n- [x] Analytics Update — x\n- [ ] Milestone — x\n\n## Push Notifications\n- [ ] Analytics Update — x\n- [x] Offer Received — x\n\n## Quiet Hours\nNotifications are held between 8:00pm and 8:00am AEST, except for offers which are sent immediately.\n`,
      'utf-8'
    );
    const prefs = await getPreferences(SLUG);
    expect(prefs.channels.email['Analytics Update']).toBe(true);
    expect(prefs.channels.email['Milestone']).toBe(false);
    expect(prefs.channels.push['Analytics Update']).toBe(false);
    expect(prefs.quietHours).toEqual({ startHour: 20, endHour: 8, offersBypass: true });
  });
});

describe('isAllowedNow', () => {
  it('blocks a disabled type regardless of time', () => {
    const prefs = { ...DEFAULT_PREFERENCES, channels: { ...DEFAULT_PREFERENCES.channels, push: { ...DEFAULT_PREFERENCES.channels.push, Milestone: false } } };
    expect(isAllowedNow(prefs, 'push', 'Milestone', new Date('2026-10-21T12:00:00+11:00'))).toBe(false);
  });

  it('defers a non-offer type during quiet hours', () => {
    const inQuietHours = new Date('2026-10-21T22:30:00+11:00'); // 10:30pm Melbourne
    expect(isAllowedNow(DEFAULT_PREFERENCES, 'push', 'Analytics Update', inQuietHours)).toBe(false);
  });

  it('allows an offer during quiet hours when offersBypass is set', () => {
    const inQuietHours = new Date('2026-10-21T22:30:00+11:00');
    expect(isAllowedNow(DEFAULT_PREFERENCES, 'push', 'Offer Received', inQuietHours)).toBe(true);
  });

  it('allows a non-offer type outside quiet hours', () => {
    const daytime = new Date('2026-10-21T14:00:00+11:00');
    expect(isAllowedNow(DEFAULT_PREFERENCES, 'push', 'Analytics Update', daytime)).toBe(true);
  });
});
