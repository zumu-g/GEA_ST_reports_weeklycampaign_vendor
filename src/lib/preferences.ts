import fs from 'fs/promises';
import path from 'path';

export type NotificationType =
  | 'Analytics Update' | 'Inspection Result' | 'Offer Received'
  | 'Checklist Update' | 'Weekly Report' | 'Milestone';

export type Channel = 'email' | 'sms' | 'push';

export interface QuietHours {
  startHour: number; // local hour, 24h
  endHour: number;
  offersBypass: boolean;
}

export interface Preferences {
  channels: Record<Channel, Record<NotificationType, boolean>>;
  quietHours: QuietHours;
}

const DEFAULT_TYPES: NotificationType[] = [
  'Analytics Update', 'Inspection Result', 'Offer Received', 'Checklist Update', 'Weekly Report', 'Milestone',
];

function allEnabled(): Record<NotificationType, boolean> {
  return Object.fromEntries(DEFAULT_TYPES.map(t => [t, true])) as Record<NotificationType, boolean>;
}

export const DEFAULT_PREFERENCES: Preferences = {
  channels: { email: allEnabled(), sms: allEnabled(), push: allEnabled() },
  quietHours: { startHour: 20, endHour: 8, offersBypass: true },
};

function parseChannelSection(content: string, heading: string): Record<NotificationType, boolean> | null {
  const match = content.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?:\\n## |$)`));
  if (!match) return null;
  const result = {} as Record<NotificationType, boolean>;
  for (const type of DEFAULT_TYPES) {
    const line = match[1].match(new RegExp(`- \\[(x| )\\]\\s*${type.replace(/\s/g, '\\s')}`, 'i'));
    result[type] = line ? line[1].toLowerCase() === 'x' : true;
  }
  return result;
}

function parseQuietHours(content: string): QuietHours {
  const match = content.match(/between\s+(\d{1,2}):?(\d{2})?\s*([ap]m)\s+and\s+(\d{1,2}):?(\d{2})?\s*([ap]m)/i);
  const offersBypass = /except for offers/i.test(content);
  if (!match) return { ...DEFAULT_PREFERENCES.quietHours, offersBypass };

  const to24h = (h: string, ampm: string) => {
    let hour = parseInt(h, 10) % 12;
    if (ampm.toLowerCase() === 'pm') hour += 12;
    return hour;
  };
  return {
    startHour: to24h(match[1], match[3]),
    endHour: to24h(match[4], match[6]),
    offersBypass,
  };
}

function propertiesDir(): string {
  return (
    process.env.PROPERTIES_DIR ||
    '/Users/stuartgrant_mbp13/Library/Mobile Documents/com~apple~CloudDocs/GEA_ST_vendor_portal/properties'
  );
}

// Reads properties/{slug}/PREFERENCES.md if it exists, else the defaults
// below (every type enabled on every channel, 20:00-08:00 Melbourne quiet
// hours with offers exempt — matching PREFERENCES_TEMPLATE.md).
export async function getPreferences(slug: string): Promise<Preferences> {
  const filePath = path.join(propertiesDir(), slug, 'PREFERENCES.md');
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return DEFAULT_PREFERENCES;
  }

  return {
    channels: {
      email: parseChannelSection(content, 'Email Notifications') ?? allEnabled(),
      sms: parseChannelSection(content, 'SMS Notifications') ?? allEnabled(),
      push: parseChannelSection(content, 'Push Notifications') ?? allEnabled(),
    },
    quietHours: parseQuietHours(content),
  };
}

// Whether `type` on `channel` may be sent right now (local Melbourne time).
// An offer bypasses quiet hours when the preferences say so (R8).
export function isAllowedNow(
  prefs: Preferences,
  channel: Channel,
  type: NotificationType,
  now: Date = new Date(),
): boolean {
  if (!prefs.channels[channel][type]) return false;
  if (type === 'Offer Received' && prefs.quietHours.offersBypass) return true;

  const hour = Number(
    now.toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', hour12: false }),
  );
  const { startHour, endHour } = prefs.quietHours;
  const inQuietHours = startHour > endHour
    ? hour >= startHour || hour < endHour
    : hour >= startHour && hour < endHour;
  return !inQuietHours;
}
