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

// Collapses to a single line so scraped text can't inject a fake markdown
// bullet ("\n- [spoofed](url) — ...") into the Market News section it later
// gets written into (appendMarketNews).
function singleLine(s: string): string {
  return s.replace(/\r?\n+/g, ' ').trim();
}

// Blocks SSRF: the URL is agent-supplied free text, not trusted input, and
// this is a server-side fetch — reject anything that isn't a public http(s)
// host before ever calling fetch(). Hostname-string checks alone are not
// enough (DNS rebinding), but this closes the common cases: loopback,
// link-local (incl. cloud metadata at 169.254.169.254), and private ranges.
function isDisallowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 0) return true;
  }
  return false;
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return !isDisallowedHost(parsed.hostname);
  } catch {
    return false;
  }
}

export async function fetchArticleMeta(url: string): Promise<{ title: string; note: string } | null> {
  if (!isAllowedUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GEA Weekly Report Bot)' },
      redirect: 'error', // don't silently follow a public URL into a private redirect target
    });
    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = singleLine(decodeEntities((titleMatch?.[1] ?? '').trim()));
    if (!title) return null;

    const note = singleLine(extractMeta(html, 'og:description') || extractMeta(html, 'description'));
    return { title, note };
  } catch {
    return null;
  }
}
