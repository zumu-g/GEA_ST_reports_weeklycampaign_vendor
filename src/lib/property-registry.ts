// Resolves a Telegram/WhatsApp shorthand keyword (e.g. "85 centenary",
// "berwick") to a property, derived from the live property set (U5) instead
// of a hand-maintained list — so ingest keeps working as listings come and
// go without a code change. Falls back to the local markdown set during a
// CRM outage (fail-open: ingest shouldn't stop working just because the CRM
// is briefly unreachable).
import { getLivePropertyData } from '@/lib/live-properties';

export interface RegisteredProperty {
  slug: string;
  address: string;
  owner: string;
}

// Street number + street name (e.g. "85 centenary" from "85 Centenary
// Boulevard, Officer South VIC 3809") is specific enough to key on alone.
function streetKeyword(address: string): string | null {
  const match = address.match(/^(\d+\s+[a-z]+)/i);
  return match ? match[1].toLowerCase() : null;
}

// Suburb (e.g. "officer south", "berwick") — only usable as a keyword when
// exactly one live property sits in that suburb.
function suburbKeyword(address: string): string | null {
  const parts = address.split(',');
  if (parts.length < 2) return null;
  const suburb = parts[1]
    .replace(/\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\b/i, '')
    .replace(/\d{4}/, '')
    .trim()
    .toLowerCase();
  return suburb || null;
}

async function buildKeywordMap(): Promise<Map<string, RegisteredProperty>> {
  const { properties } = await getLivePropertyData();
  const registered = properties.map((p) => ({ slug: p.slug, address: p.address, owner: p.owner }));

  const byStreet = new Map<string, RegisteredProperty>();
  const bySuburbCount = new Map<string, number>();
  const bySuburbProperty = new Map<string, RegisteredProperty>();

  for (const property of registered) {
    const street = streetKeyword(property.address);
    if (street) byStreet.set(street, property);

    const suburb = suburbKeyword(property.address);
    if (suburb) {
      bySuburbCount.set(suburb, (bySuburbCount.get(suburb) ?? 0) + 1);
      bySuburbProperty.set(suburb, property);
    }
  }

  const keywords = new Map<string, RegisteredProperty>(byStreet);
  for (const [suburb, count] of bySuburbCount) {
    // Ambiguous — two live listings share a suburb — don't guess.
    if (count === 1) keywords.set(suburb, bySuburbProperty.get(suburb)!);
  }
  return keywords;
}

export async function resolveProperty(text: string): Promise<RegisteredProperty | null> {
  const lower = text.toLowerCase().trim();
  const keywords = await buildKeywordMap();
  for (const [keyword, property] of keywords) {
    if (lower.includes(keyword)) return property;
  }
  return null;
}
