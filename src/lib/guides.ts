import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const GUIDES_DIR = path.join(process.cwd(), 'content', 'guides');

export interface GuideMeta {
  slug: string;
  title: string;
  summary: string;
  category: string;
  cover_image?: string;
  read_time_min: number;
}

export interface Guide extends GuideMeta {
  body: string;
}

export async function listGuides(): Promise<GuideMeta[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(GUIDES_DIR);
  } catch {
    return [];
  }
  const guides: GuideMeta[] = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const raw = await fs.readFile(path.join(GUIDES_DIR, f), 'utf-8');
    const { data } = matter(raw);
    guides.push({
      slug: data.slug || f.replace(/\.md$/, ''),
      title: data.title || f,
      summary: data.summary || '',
      category: data.category || 'General',
      cover_image: data.cover_image,
      read_time_min: Number(data.read_time_min) || 3,
    });
  }
  return guides.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getGuide(slug: string): Promise<Guide | null> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(GUIDES_DIR, `${slug}.md`), 'utf-8');
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title || slug,
    summary: data.summary || '',
    category: data.category || 'General',
    cover_image: data.cover_image,
    read_time_min: Number(data.read_time_min) || 3,
    body: content,
  };
}

/** Minimal MD → HTML for guide body. Handles headings, paragraphs, lists, bold, italics, links. */
export function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  let paragraph: string[] = [];

  const flushPara = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) { out.push('</ul>'); inList = false; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); closeList(); continue; }

    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flushPara(); closeList();
      const level = h[1].length + 1; // h1 → h2, h2 → h3, h3 → h4
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    const li = line.match(/^[-*]\s+(.+)$/);
    if (li) {
      flushPara();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line);
  }
  flushPara(); closeList();
  return out.join('\n');
}

function inline(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
