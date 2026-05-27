import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const PROPERTIES_DIR = process.env.PROPERTIES_DIR || '/Users/stuartgrant_mbp13/Library/Mobile Documents/com~apple~CloudDocs/GEA_vendor_portal/properties';

// --- Types ---

export interface NewsItem {
  title: string;
  url: string;
  summary: string;
}

export interface PropertyData {
  slug: string;
  address: string;
  owner: string;
  contact: string;
  listed: string;
  priceGuide: string;
  campaignType: string;
  agent: string;
  calendarId: string;
  checklist: { task: string; done: boolean }[];
  latestUpdate: string;
  analytics: AnalyticsRow[];
  inspections: InspectionRow[];
  communications: CommunicationRow[];
  news: NewsItem[];
}

export interface AnalyticsRow {
  weekEnding: string;
  reaViews: number;
  reaEnquiries: number;
  reaSaves: number;
  domainViews: number;
  domainEnquiries: number;
  domainSaves: number;
}

export interface InspectionRow {
  date: string;
  type: string;
  groups: number;
  interestLevel: string;
  notes: string;
}

export interface CommunicationRow {
  date: string;
  type: string;
  summary: string;
}

export interface AnalyticsDetail {
  weekEnding: string;
  property: string;
  source: string;
  views: number;
  enquiries: number;
  saves: number;
  searchAppearances: number;
  notes: string;
}

export interface InspectionDetail {
  date: string;
  property: string;
  type: string;
  totalGroups: number;
  interested: number;
  interestLevel: string;
  agentNotes: string;
}

// --- Parsers ---

function parsePropertyDetails(content: string): Partial<PropertyData> {
  const get = (label: string): string => {
    const match = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
    return match ? match[1].trim() : '';
  };

  return {
    owner: get('Owner'),
    contact: get('Contact'),
    listed: get('Listed'),
    priceGuide: get('Price Guide'),
    campaignType: get('Campaign Type'),
    agent: get('Agent'),
    calendarId: get('Calendar ID'),
  };
}

function parseChecklist(content: string): { task: string; done: boolean }[] {
  const items: { task: string; done: boolean }[] = [];
  const regex = /- \[(x| )\] (.+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    items.push({ task: match[2].trim(), done: match[1] === 'x' });
  }
  return items;
}

function parseLatestUpdate(content: string): string {
  const match = content.match(/## Latest Update\n([\s\S]+?)(?:\n\n|\n##)/);
  return match ? match[1].trim() : '';
}

function parseMarkdownTable(content: string, headerPattern: string): Record<string, string>[] {
  const lines = content.split('\n');
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(headerPattern)) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const headers = lines[headerIndex]
    .split('|')
    .map(h => h.trim())
    .filter(Boolean);

  const rows: Record<string, string>[] = [];
  // Skip separator line (headerIndex + 1), start at headerIndex + 2
  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length === 0 || cells.every(c => c === '')) break;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function parseAnalyticsTable(content: string): AnalyticsRow[] {
  const rows = parseMarkdownTable(content, 'Week Ending');
  return rows
    .filter(r => r['Week Ending'] && r['Week Ending'].trim() !== '')
    .map(r => ({
      weekEnding: r['Week Ending'] || '',
      reaViews: parseInt(r['REA Views'] || '0', 10) || 0,
      reaEnquiries: parseInt(r['REA Enquiries'] || '0', 10) || 0,
      reaSaves: parseInt(r['REA Saves'] || '0', 10) || 0,
      domainViews: parseInt(r['Domain Views'] || '0', 10) || 0,
      domainEnquiries: parseInt(r['Domain Enquiries'] || '0', 10) || 0,
      domainSaves: parseInt(r['Domain Saves'] || '0', 10) || 0,
    }));
}

function parseInspectionsTable(content: string): InspectionRow[] {
  const rows = parseMarkdownTable(content, 'Date');
  return rows
    .filter(r => r['Date'] && r['Date'].trim() !== '')
    .map(r => ({
      date: r['Date'] || '',
      type: r['Type'] || '',
      groups: parseInt(r['Groups'] || '0', 10) || 0,
      interestLevel: r['Interest Level'] || r['Interest'] || '',
      notes: r['Notes'] || '',
    }));
}

function parseCommunicationsTable(content: string): CommunicationRow[] {
  const rows = parseMarkdownTable(content, 'Date');
  // Communications table might clash with inspections; use the one under ## Communications Log
  const commSection = content.split('## Communications Log')[1];
  if (!commSection) return [];
  const commRows = parseMarkdownTable('## Communications Log' + commSection, 'Date');
  return commRows
    .filter(r => r['Date'] && r['Date'].trim() !== '')
    .map(r => ({
      date: r['Date'] || '',
      type: r['Type'] || '',
      summary: r['Summary'] || '',
    }));
}

function parseMarketNews(content: string): NewsItem[] {
  const parts = content.split(/^## Market News/m);
  if (parts.length < 2) return [];
  const section = parts[1].split(/^## /m)[0];
  const items: NewsItem[] = [];
  const regex = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s+[—–]\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(section)) !== null) {
    items.push({ title: match[1].trim(), url: match[2].trim(), summary: match[3].trim() });
  }
  return items;
}

function parseAddress(content: string): string {
  const match = content.match(/^# (.+)/m);
  return match ? match[1].trim() : '';
}

// --- File readers ---

async function listPropertySlugs(): Promise<string[]> {
  const entries = await fs.readdir(PROPERTIES_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && !e.name.startsWith('_'))
    .map(e => e.name);
}

async function readPropertyFile(slug: string): Promise<string> {
  const filePath = path.join(PROPERTIES_DIR, slug, 'PROPERTY.md');
  return fs.readFile(filePath, 'utf-8');
}

async function listFilesInDir(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.filter(f => f.endsWith('.md'));
  } catch {
    return [];
  }
}

// --- Public API ---

export async function getAllProperties(): Promise<PropertyData[]> {
  const slugs = await listPropertySlugs();
  const properties = await Promise.all(slugs.map(slug => getProperty(slug)));
  return properties.filter((p): p is PropertyData => p !== null);
}

export async function getProperty(slug: string): Promise<PropertyData | null> {
  try {
    const content = await readPropertyFile(slug);
    const details = parsePropertyDetails(content);
    const address = parseAddress(content);

    return {
      slug,
      address,
      owner: details.owner || '',
      contact: details.contact || '',
      listed: details.listed || '',
      priceGuide: details.priceGuide || '',
      campaignType: details.campaignType || '',
      agent: details.agent || '',
      calendarId: details.calendarId || '',
      checklist: parseChecklist(content),
      latestUpdate: parseLatestUpdate(content),
      analytics: parseAnalyticsTable(content),
      inspections: parseInspectionsTable(content),
      communications: parseCommunicationsTable(content),
      news: parseMarketNews(content),
    };
  } catch {
    return null;
  }
}

export async function getPropertyAnalytics(slug: string): Promise<AnalyticsDetail[]> {
  const dirPath = path.join(PROPERTIES_DIR, slug, 'analytics');
  const files = await listFilesInDir(dirPath);
  const results: AnalyticsDetail[] = [];

  for (const file of files) {
    const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
    const get = (label: string): string => {
      const match = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
      return match ? match[1].trim() : '';
    };

    results.push({
      weekEnding: get('Week Ending') || file.replace('.md', ''),
      property: get('Property'),
      source: get('Source'),
      views: parseInt(get('Views') || '0', 10) || 0,
      enquiries: parseInt(get('Enquiries') || '0', 10) || 0,
      saves: parseInt(get('Saves/Shortlists') || get('Saves') || '0', 10) || 0,
      searchAppearances: parseInt(get('Search Appearances') || '0', 10) || 0,
      notes: '',
    });
  }

  return results.sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));
}

export async function getPropertyInspections(slug: string): Promise<InspectionDetail[]> {
  const dirPath = path.join(PROPERTIES_DIR, slug, 'inspections');
  const files = await listFilesInDir(dirPath);
  const results: InspectionDetail[] = [];

  for (const file of files) {
    const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
    const get = (label: string): string => {
      const match = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
      return match ? match[1].trim() : '';
    };

    results.push({
      date: file.replace('.md', ''),
      property: get('Property'),
      type: get('Type'),
      totalGroups: parseInt(get('Total Groups') || '0', 10) || 0,
      interested: parseInt(get('Interested Parties') || '0', 10) || 0,
      interestLevel: get('Interest Level'),
      agentNotes: '',
    });
  }

  return results.sort((a, b) => b.date.localeCompare(a.date));
}

// --- Property Creator ---

export async function createPropertyFolder(
  slug: string,
  details: {
    address: string;
    owner: string;
    contact: string;
    listed: string;
    priceGuide: string;
    campaignType: string;
  }
): Promise<void> {
  const propertyDir = path.join(PROPERTIES_DIR, slug);

  // Create subdirectories
  await fs.mkdir(path.join(propertyDir, 'analytics'), { recursive: true });
  await fs.mkdir(path.join(propertyDir, 'inspections'), { recursive: true });
  await fs.mkdir(path.join(propertyDir, 'communications'), { recursive: true });

  // Write .gitkeep placeholders
  for (const sub of ['analytics', 'inspections', 'communications']) {
    const keepFile = path.join(propertyDir, sub, '.gitkeep');
    try { await fs.access(keepFile); } catch { await fs.writeFile(keepFile, '', 'utf-8'); }
  }

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  const content = `# ${details.address}

## Property Details
- **Owner:** ${details.owner}
- **Contact:** ${details.contact}
- **Listed:** ${details.listed}
- **Price Guide:** ${details.priceGuide}
- **Campaign Type:** ${details.campaignType}
- **Agent:** Stuart Grant
- **Calendar ID:**

## Campaign Checklist
- [ ] Professional photography completed
- [ ] Floor plan drafted
- [ ] Listing live on realestate.com.au
- [ ] Listing live on domain.com.au
- [ ] First open home scheduled
- [ ] Signboard installed
- [ ] Social media campaign launched
- [ ] Brochure printed and delivered
- [ ] Contract of sale prepared
- [ ] Section 32 / Vendor Statement ready
- [ ] Agency authority signed

## Latest Update
**${today}:** Portal created. Awaiting first weekly analytics.

## Analytics Summary
| Week Ending | REA Views | REA Enquiries | REA Saves | Domain Views | Domain Enquiries | Domain Saves |
|-------------|-----------|---------------|-----------|--------------|------------------|--------------|
|             |           |               |           |              |                  |              |

## Inspection History
| Date | Type | Groups | Interest Level | Notes |
|------|------|--------|----------------|-------|
|      |      |        |                |       |

## Communications Log
| Date | Type | Summary |
|------|------|---------|
| ${today} | Portal | Client portal created |
`;

  const propertyFile = path.join(propertyDir, 'PROPERTY.md');
  await fs.writeFile(propertyFile, content, 'utf-8');
}

// --- Writers ---

export async function writeAnalyticsFile(
  slug: string,
  data: {
    source: string;
    weekEnding: string;
    views: number;
    enquiries: number;
    saves: number;
    searchAppearances?: number;
  }
): Promise<string> {
  const sourceSlug = data.source.toLowerCase().includes('domain') ? 'domain' : 'rea';
  const fileName = `${data.weekEnding}-${sourceSlug}.md`;
  const dirPath = path.join(PROPERTIES_DIR, slug, 'analytics');
  await fs.mkdir(dirPath, { recursive: true });
  const filePath = path.join(dirPath, fileName);

  const content = `# Weekly Analytics — ${data.weekEnding}

**Property:** ${slug}
**Source:** ${data.source === 'rea' ? 'realestate.com.au' : 'domain.com.au'}

## Portal Statistics
- **Views:** ${data.views}
- **Enquiries:** ${data.enquiries}
- **Saves/Shortlists:** ${data.saves}
- **Search Appearances:** ${data.searchAppearances || 0}

## Notes
Auto-ingested on ${new Date().toISOString().split('T')[0]}
`;

  await fs.writeFile(filePath, content, 'utf-8');

  // Update PROPERTY.md analytics summary table
  await appendToPropertyTable(slug, 'analytics', data);

  return filePath;
}

export async function writeInspectionFile(
  slug: string,
  data: {
    date: string;
    type: string;
    groups: number;
    interested: number;
    interestLevel: string;
    notes: string;
  }
): Promise<string> {
  const typeSlug = data.type.toLowerCase().includes('private') ? 'private' : 'open';
  const fileName = `${data.date}-${typeSlug}.md`;
  const dirPath = path.join(PROPERTIES_DIR, slug, 'inspections');
  await fs.mkdir(dirPath, { recursive: true });
  const filePath = path.join(dirPath, fileName);

  const content = `# Inspection — ${data.date}

**Property:** ${slug}
**Type:** ${data.type}

## Summary
- **Total Groups:** ${data.groups}
- **Interested Parties:** ${data.interested}
- **Interest Level:** ${data.interestLevel}

## Agent Notes
${data.notes}

Auto-ingested on ${new Date().toISOString().split('T')[0]}
`;

  await fs.writeFile(filePath, content, 'utf-8');

  // Update PROPERTY.md inspection history table
  await appendToPropertyTable(slug, 'inspection', data);

  return filePath;
}

async function appendToPropertyTable(
  slug: string,
  type: 'analytics' | 'inspection',
  data: Record<string, unknown>
): Promise<void> {
  const propertyPath = path.join(PROPERTIES_DIR, slug, 'PROPERTY.md');

  try {
    let content = await fs.readFile(propertyPath, 'utf-8');

    if (type === 'analytics') {
      const d = data as {
        weekEnding: string;
        source: string;
        views: number;
        enquiries: number;
        saves: number;
      };
      // Find the analytics table and append a row or update existing week
      const tableHeader = '| Week Ending | REA Views | REA Enquiries | REA Saves | Domain Views | Domain Enquiries | Domain Saves |';
      const headerIdx = content.indexOf(tableHeader);
      if (headerIdx === -1) return;

      // Find separator line
      const afterHeader = content.indexOf('\n', headerIdx);
      const afterSeparator = content.indexOf('\n', afterHeader + 1);

      const isRea = d.source.toLowerCase().includes('rea') || d.source.toLowerCase() === 'rea';
      const existingRowRegex = new RegExp(`\\| ${d.weekEnding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|`);
      const existingMatch = content.match(existingRowRegex);

      if (existingMatch && existingMatch.index !== undefined) {
        // Update existing row - find full line
        const lineStart = content.lastIndexOf('\n', existingMatch.index) + 1;
        const lineEnd = content.indexOf('\n', existingMatch.index);
        const existingLine = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd);
        const cells = existingLine.split('|').map(c => c.trim()).filter(Boolean);

        if (isRea) {
          cells[1] = String(d.views);
          cells[2] = String(d.enquiries);
          cells[3] = String(d.saves);
        } else {
          cells[4] = String(d.views);
          cells[5] = String(d.enquiries);
          cells[6] = String(d.saves);
        }

        const newLine = '| ' + cells.join(' | ') + ' |';
        content = content.substring(0, lineStart) + newLine + content.substring(lineEnd === -1 ? content.length : lineEnd);
      } else {
        // Add new row
        const newRow = isRea
          ? `| ${d.weekEnding} | ${d.views} | ${d.enquiries} | ${d.saves} | | | |`
          : `| ${d.weekEnding} | | | | ${d.views} | ${d.enquiries} | ${d.saves} |`;

        const insertAt = afterSeparator + 1;
        content = content.substring(0, insertAt) + newRow + '\n' + content.substring(insertAt);
      }
    } else if (type === 'inspection') {
      const d = data as {
        date: string;
        type: string;
        groups: number;
        interestLevel: string;
        notes: string;
      };
      const tableHeader = '| Date | Type | Groups | Interest Level | Notes |';
      const headerIdx = content.indexOf(tableHeader);
      if (headerIdx === -1) return;

      const afterHeader = content.indexOf('\n', headerIdx);
      const afterSeparator = content.indexOf('\n', afterHeader + 1);

      const newRow = `| ${d.date} | ${d.type} | ${d.groups} | ${d.interestLevel} | ${d.notes} |`;
      const insertAt = afterSeparator + 1;
      content = content.substring(0, insertAt) + newRow + '\n' + content.substring(insertAt);
    }

    await fs.writeFile(propertyPath, content, 'utf-8');
  } catch {
    // Property file may not exist yet
  }
}

// --- Stats sidecar (denormalised weekly snapshots from REA/Domain) ---

export interface StatsRow {
  weekEnding: string;
  source: string; // 'rea' | 'domain'
  views: number;
  enquiries: number;
  saves: number;
}

export async function readStats(slug: string): Promise<StatsRow[]> {
  return readJsonSidecar<StatsRow>(slug, 'stats.json');
}

export async function upsertStats(slug: string, row: StatsRow): Promise<void> {
  const items = await readStats(slug);
  const src = row.source.toLowerCase();
  const idx = items.findIndex(
    s => s.weekEnding === row.weekEnding && s.source.toLowerCase() === src,
  );
  const normalised: StatsRow = { ...row, source: src };
  if (idx >= 0) items[idx] = normalised;
  else items.push(normalised);
  items.sort((a, b) => (a.weekEnding < b.weekEnding ? 1 : -1));
  await writeJsonSidecar(slug, 'stats.json', items);
}

export interface LiveStats {
  reaViews: number; reaEnquiries: number;
  domainViews: number; domainEnquiries: number;
  reaViewsDelta: number; reaEnquiriesDelta: number;
  domainViewsDelta: number; domainEnquiriesDelta: number;
  weekEnding: string | null;
}

export async function getLiveStats(slug: string): Promise<LiveStats | null> {
  const rows = await readStats(slug);
  if (!rows.length) return null;
  const weeks = Array.from(new Set(rows.map(r => r.weekEnding))).sort().reverse();
  const [w0, w1] = weeks;
  const pick = (we: string | undefined, src: string) =>
    rows.find(r => r.weekEnding === we && r.source.toLowerCase() === src);
  const r0 = pick(w0, 'rea'); const d0 = pick(w0, 'domain');
  const r1 = pick(w1, 'rea'); const d1 = pick(w1, 'domain');
  return {
    reaViews: r0?.views ?? 0,
    reaEnquiries: r0?.enquiries ?? 0,
    domainViews: d0?.views ?? 0,
    domainEnquiries: d0?.enquiries ?? 0,
    reaViewsDelta: (r0?.views ?? 0) - (r1?.views ?? 0),
    reaEnquiriesDelta: (r0?.enquiries ?? 0) - (r1?.enquiries ?? 0),
    domainViewsDelta: (d0?.views ?? 0) - (d1?.views ?? 0),
    domainEnquiriesDelta: (d0?.enquiries ?? 0) - (d1?.enquiries ?? 0),
    weekEnding: w0 ?? null,
  };
}

// --- Opens sidecar ---

export interface OpenEntry {
  id: string;
  start: string; // ISO
  end: string;   // ISO
  source: 'clickup' | 'manual';
  note?: string;
}

export async function readOpens(slug: string): Promise<OpenEntry[]> {
  return readJsonSidecar<OpenEntry>(slug, 'opens.json');
}

export async function upsertOpen(slug: string, entry: OpenEntry): Promise<void> {
  const items = await readOpens(slug);
  const idx = items.findIndex(o => o.id === entry.id);
  if (idx >= 0) items[idx] = entry;
  else items.push(entry);
  await writeJsonSidecar(slug, 'opens.json', items);
}

export async function removeOpen(slug: string, id: string): Promise<void> {
  const items = await readOpens(slug);
  const filtered = items.filter(o => o.id !== id);
  if (filtered.length !== items.length) {
    await writeJsonSidecar(slug, 'opens.json', filtered);
  }
}

// --- Checklist writer ---

function normaliseLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

/**
 * Find the Campaign Checklist line that best matches `label` and flip its
 * checkbox to `done`. If no line matches within Levenshtein 3 (on normalised
 * text), append a new item to the end of the checklist so nothing is silently
 * dropped. Returns true if the file was modified.
 */
export async function setChecklistItem(
  slug: string,
  label: string,
  done: boolean,
): Promise<boolean> {
  const propertyPath = path.join(PROPERTIES_DIR, slug, 'PROPERTY.md');
  let content: string;
  try {
    content = await fs.readFile(propertyPath, 'utf-8');
  } catch {
    return false;
  }

  const sectionStart = content.indexOf('## Campaign Checklist');
  if (sectionStart === -1) return false;
  const sectionRelEnd = content.slice(sectionStart).search(/\n## /);
  const sectionEnd = sectionRelEnd === -1 ? content.length : sectionStart + sectionRelEnd;
  const section = content.slice(sectionStart, sectionEnd);

  const lines = section.split('\n');
  const target = normaliseLabel(label);
  let bestIdx = -1;
  let bestScore = Infinity;
  const itemRegex = /^- \[(x| )\] (.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(itemRegex);
    if (!m) continue;
    const candidate = normaliseLabel(m[2]);
    if (candidate === target) { bestIdx = i; bestScore = 0; break; }
    const dist = levenshtein(target, candidate);
    if (dist < bestScore) { bestScore = dist; bestIdx = i; }
  }

  let newSection: string;
  if (bestIdx !== -1 && bestScore <= 3) {
    const m = lines[bestIdx].match(itemRegex)!;
    const mark = done ? 'x' : ' ';
    if (m[1] === mark) return false;
    lines[bestIdx] = `- [${mark}] ${m[2]}`;
    newSection = lines.join('\n');
  } else {
    let lastItem = -1;
    for (let i = 0; i < lines.length; i++) {
      if (itemRegex.test(lines[i])) lastItem = i;
    }
    const insertAt = lastItem === -1 ? lines.length : lastItem + 1;
    lines.splice(insertAt, 0, `- [${done ? 'x' : ' '}] ${label}`);
    newSection = lines.join('\n');
  }

  const newContent = content.slice(0, sectionStart) + newSection + content.slice(sectionEnd);
  if (newContent === content) return false;
  await fs.writeFile(propertyPath, newContent, 'utf-8');
  return true;
}

// --- Activity feed + comments (JSON sidecars) ---

export type ActivitySource = 'clickup' | 'telegram' | 'analytics' | 'inspection' | 'comment';

export interface ActivityEvent {
  id: string;
  ts: string;
  source: ActivitySource;
  actor: string;
  summary: string;
  meta?: Record<string, unknown>;
}

export interface CommentEntry {
  id: string;
  ts: string;
  author: 'agent' | 'vendor';
  body: string;
  read_by_agent: boolean;
  read_by_vendor: boolean;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function readJsonSidecar<T>(slug: string, file: string): Promise<T[]> {
  const filePath = path.join(PROPERTIES_DIR, slug, file);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJsonSidecar<T>(slug: string, file: string, items: T[]): Promise<void> {
  const dir = path.join(PROPERTIES_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, file);
  await fs.writeFile(filePath, JSON.stringify(items, null, 2) + '\n', 'utf-8');
}

export async function readActivity(slug: string): Promise<ActivityEvent[]> {
  return readJsonSidecar<ActivityEvent>(slug, 'activity.json');
}

export async function appendActivity(
  slug: string,
  event: Omit<ActivityEvent, 'id' | 'ts'> & { ts?: string }
): Promise<ActivityEvent> {
  const items = await readActivity(slug);
  const entry: ActivityEvent = {
    id: randomId(),
    ts: event.ts || new Date().toISOString(),
    source: event.source,
    actor: event.actor,
    summary: event.summary,
    meta: event.meta,
  };
  items.push(entry);
  await writeJsonSidecar(slug, 'activity.json', items);
  return entry;
}

export async function readComments(slug: string): Promise<CommentEntry[]> {
  return readJsonSidecar<CommentEntry>(slug, 'comments.json');
}

export async function appendComment(
  slug: string,
  comment: Omit<CommentEntry, 'id' | 'ts' | 'read_by_agent' | 'read_by_vendor'>
): Promise<CommentEntry> {
  const items = await readComments(slug);
  const entry: CommentEntry = {
    id: randomId(),
    ts: new Date().toISOString(),
    author: comment.author,
    body: comment.body,
    read_by_agent: comment.author === 'agent',
    read_by_vendor: comment.author === 'vendor',
  };
  items.push(entry);
  await writeJsonSidecar(slug, 'comments.json', items);
  return entry;
}

export interface TimelineEntry {
  id: string;
  ts: string;
  source: ActivitySource;
  actor: string;
  summary: string;
  body?: string;
}

export async function getUnifiedTimeline(slug: string, opts: { limit?: number } = {}): Promise<TimelineEntry[]> {
  const [activity, comments] = await Promise.all([readActivity(slug), readComments(slug)]);

  const out: TimelineEntry[] = [];
  for (const a of activity) {
    out.push({ id: a.id, ts: a.ts, source: a.source, actor: a.actor, summary: a.summary });
  }
  for (const c of comments) {
    out.push({
      id: c.id,
      ts: c.ts,
      source: 'comment',
      actor: c.author === 'agent' ? 'Agent' : 'You',
      summary: c.body.slice(0, 140),
      body: c.body,
    });
  }

  out.sort((a, b) => b.ts.localeCompare(a.ts));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

// --- Outbound notification queue (drained by scripts/dispatch_notifications.py) ---

export interface OutboundNotification {
  id: string;
  channel: 'email' | 'sms' | 'both';
  to: { email?: string; phone?: string };
  vendor?: string;
  slug?: string;
  subject?: string;
  body: string;
  portalUrl?: string;
  created_at: string;
}

/**
 * Queue a vendor notification by writing a JSON file into `_outbound/`.
 * The Python dispatcher (cron, every 5 min) picks it up and sends via
 * Resend (email) and/or Twilio (SMS), then archives it to `_outbound/sent/`.
 */
export async function enqueueNotification(
  n: Omit<OutboundNotification, 'id' | 'created_at'> & { id?: string; created_at?: string },
): Promise<OutboundNotification> {
  const entry: OutboundNotification = {
    id: n.id || randomId(),
    channel: n.channel,
    to: n.to,
    vendor: n.vendor,
    slug: n.slug,
    subject: n.subject,
    body: n.body,
    portalUrl: n.portalUrl,
    created_at: n.created_at || new Date().toISOString(),
  };
  const dir = path.join(PROPERTIES_DIR, '_outbound');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${entry.id}.json`), JSON.stringify(entry, null, 2) + '\n', 'utf-8');
  return entry;
}
