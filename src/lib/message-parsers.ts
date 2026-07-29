/**
 * Free-form-note and inspection-shorthand parsers, shared by the Telegram
 * and WhatsApp ingest routes. Extracted from the Telegram route (U5) so both
 * channels parse identically instead of maintaining two copies.
 */

// Matches "Add this article link and summary to all property reports this week
// https://... \n<title>\n<summary>". Checked before parseFreeformNote /
// parseTelegramMessage so it can't be shadowed by (or shadow) them — the
// trigger phrase makes this far more specific than either.
const URL_RE = /(https?:\/\/\S+)/;

export function parseArticleBroadcast(
  message: string
): { url: string; title?: string; note?: string } | null {
  if (!/^\s*add this article/i.test(message)) return null;

  const urlMatch = message.match(URL_RE);
  if (!urlMatch) return null;
  // Trim trailing punctuation/markup the URL regex greedily swallows when
  // the link sits in prose or a markdown link, e.g. "https://x.com/a)." or
  // "https://x.com/a]" — otherwise the broken URL breaks both the written
  // markdown link and the dedup key on a resend.
  const url = urlMatch[1].replace(/[).,\]>'"]+$/, '');

  const after = message.slice(urlMatch.index! + urlMatch[1].length);
  const lines = after.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { url };

  const [title, ...rest] = lines;
  const note = rest.join(' ');
  return note ? { url, title, note } : { url, title };
}

// Splits "85 Centenary | note: spoke to buyer" or "#feed 85 Centenary spoke to buyer"
// into { propertyText, note } if it is a free-form note rather than an inspection.
export function parseFreeformNote(message: string): { propertyText: string; note: string; sender?: string } | null {
  const feedTag = message.match(/^\s*#feed\s+(.+)$/i);
  if (feedTag) {
    const rest = feedTag[1].trim();
    // First 2-3 words are the property keyword
    const m = rest.match(/^(\S+(?:\s+\S+){0,2})\s+(.+)$/);
    if (!m) return null;
    return { propertyText: m[1], note: m[2].trim() };
  }

  // Pipe form: "85 Centenary | note: ..."
  if (message.includes('|')) {
    const parts = message.split('|').map(p => p.trim());
    if (parts.length >= 2 && /^note\s*:/i.test(parts[1])) {
      const note = parts[1].replace(/^note\s*:\s*/i, '');
      const extra = parts.slice(2).join(' | ').trim();
      return { propertyText: parts[0], note: extra ? `${note} — ${extra}` : note };
    }
  }

  // Colon form: "85 Centenary: note: ..."
  const colonMatch = message.match(/^([^:]+):\s*note\s*:\s*(.+)$/i);
  if (colonMatch) {
    return { propertyText: colonMatch[1].trim(), note: colonMatch[2].trim() };
  }

  return null;
}

// Parses inspection shorthand:
// "85 Centenary | open | 3 groups | 1 interested | felt overpriced"
// "14 Hartsmere: private, John Smith, very keen, wants 2nd look"
export function parseTelegramMessage(message: string): {
  propertyText: string;
  type: string;
  groups: number;
  interested: number;
  interestLevel: string;
  notes: string;
} | null {
  // Try pipe-delimited format first
  if (message.includes('|')) {
    const parts = message.split('|').map(p => p.trim());
    if (parts.length < 2) return null;

    const propertyText = parts[0];
    const type = parts[1] || 'open';
    const groupsMatch = (parts[2] || '').match(/(\d+)/);
    const interestedMatch = (parts[3] || '').match(/(\d+)/);

    return {
      propertyText,
      type: type.toLowerCase().includes('private') ? 'Private Inspection' : 'Open Home',
      groups: groupsMatch ? parseInt(groupsMatch[1], 10) : 0,
      interested: interestedMatch ? parseInt(interestedMatch[1], 10) : 0,
      interestLevel: interestedMatch
        ? parseInt(interestedMatch[1], 10) > 2 ? 'High' : parseInt(interestedMatch[1], 10) > 0 ? 'Medium' : 'Low'
        : 'Low',
      notes: parts.slice(4).join(', ') || '',
    };
  }

  // Try colon/comma format: "14 Hartsmere: private, 3 groups, 1 interested, notes"
  const colonSplit = message.split(/[:]/);
  if (colonSplit.length >= 2) {
    const propertyText = colonSplit[0].trim();
    const rest = colonSplit.slice(1).join(':').trim();
    const parts = rest.split(',').map(p => p.trim());

    const type = parts[0] || 'open';
    const groupsMatch = rest.match(/(\d+)\s*group/i);
    const interestedMatch = rest.match(/(\d+)\s*interest/i);

    return {
      propertyText,
      type: type.toLowerCase().includes('private') ? 'Private Inspection' : 'Open Home',
      groups: groupsMatch ? parseInt(groupsMatch[1], 10) : 0,
      interested: interestedMatch ? parseInt(interestedMatch[1], 10) : 0,
      interestLevel: rest.toLowerCase().includes('keen') || rest.toLowerCase().includes('strong')
        ? 'High'
        : rest.toLowerCase().includes('soft') || rest.toLowerCase().includes('low')
          ? 'Low'
          : 'Medium',
      notes: parts.slice(1).join(', '),
    };
  }

  // Try dash format: "Calibar - open - 5 groups"
  const dashParts = message.split('-').map(p => p.trim());
  if (dashParts.length >= 2) {
    const propertyText = dashParts[0];
    const type = dashParts[1] || 'open';
    const groupsMatch = message.match(/(\d+)\s*group/i);
    const interestedMatch = message.match(/(\d+)\s*interest/i);

    return {
      propertyText,
      type: type.toLowerCase().includes('private') ? 'Private Inspection' : 'Open Home',
      groups: groupsMatch ? parseInt(groupsMatch[1], 10) : 0,
      interested: interestedMatch ? parseInt(interestedMatch[1], 10) : 0,
      interestLevel: 'Medium',
      notes: dashParts.slice(2).join(', '),
    };
  }

  return null;
}
