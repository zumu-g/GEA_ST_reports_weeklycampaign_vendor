import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Article {
  title: string;
  url: string;
  note: string;
  source?: string;
  publishedAt?: string;
}

const QUERIES = [
  'Berwick property market',
  'Casey council property prices',
  'Cardinia property market',
  'Pakenham property market',
  'Melbourne south east property market',
  'Australian property market',
];

const RSS_BASE = 'https://news.google.com/rss/search';

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripCData(s: string): string {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : s;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseItem(xml: string): Article | null {
  const get = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return m ? stripCData(m[1]).trim() : '';
  };

  const title = decodeEntities(get('title'));
  const link = get('link');
  const description = decodeEntities(stripTags(get('description')));
  const source = decodeEntities(get('source'));
  const pubDate = get('pubDate');

  if (!title || !link) return null;

  return {
    title,
    url: link,
    note: description || `${source ? source + ' · ' : ''}Market update relevant to this campaign.`,
    source,
    publishedAt: pubDate,
  };
}

async function fetchQuery(q: string): Promise<Article[]> {
  const url = `${RSS_BASE}?q=${encodeURIComponent(q)}&hl=en-AU&gl=AU&ceid=AU:en`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GEA Weekly Report Bot)' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return items.map(parseItem).filter((a): a is Article => a !== null);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { suburb?: string; propertyAddress?: string };
  const suburb = body.suburb?.trim() || body.propertyAddress?.split(',')[1]?.trim() || '';

  const queries = [...QUERIES];
  if (suburb && !queries.some(q => q.toLowerCase().includes(suburb.toLowerCase()))) {
    queries.unshift(`${suburb} property market`);
  }

  const results = await Promise.all(queries.map(fetchQuery));
  const seen = new Set<string>();
  const merged: Article[] = [];

  for (const list of results) {
    for (const a of list) {
      const key = a.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(a);
    }
  }

  merged.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  const articles = merged.slice(0, 6);

  return NextResponse.json({ articles });
}
