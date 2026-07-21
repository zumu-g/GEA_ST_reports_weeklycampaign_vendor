/**
 * Fetches a page and extracts a title + description for the article-broadcast
 * flow (U2), used only when the Telegram message has no inline title/summary.
 */

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

function extractMeta(html: string, name: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`,
    'i'
  );
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : '';
}

export async function fetchArticleMeta(url: string): Promise<{ title: string; note: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GEA Weekly Report Bot)' },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = decodeEntities((titleMatch?.[1] ?? '').trim());
    if (!title) return null;

    const note = extractMeta(html, 'og:description') || extractMeta(html, 'description');
    return { title, note };
  } catch {
    return null;
  }
}
