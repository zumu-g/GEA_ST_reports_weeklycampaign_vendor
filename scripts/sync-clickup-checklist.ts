/**
 * Backfill: pull every task from each property's ClickUp list and flip the
 * matching Campaign Checklist boxes in PROPERTY.md to match current status.
 *
 * Run:  npx tsx scripts/sync-clickup-checklist.ts [slug]
 *       (no slug = all properties)
 */
import { CLICKUP_LIST_IDS } from '../src/lib/clickup-config';
import { setChecklistItem } from '../src/lib/markdown-loader';

const DONE_STATUSES = new Set(['complete', 'completed', 'closed', 'done']);

interface ClickUpTask {
  id: string;
  name: string;
  status?: { status?: string };
}

async function fetchTasks(listId: string, apiKey: string): Promise<ClickUpTask[]> {
  const all: ClickUpTask[] = [];
  let page = 0;
  while (true) {
    const url = `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true&subtasks=true&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) throw new Error(`ClickUp ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const tasks: ClickUpTask[] = data.tasks ?? [];
    all.push(...tasks);
    if (tasks.length < 100) break;
    page++;
  }
  return all;
}

async function sync(slug: string, listId: string, apiKey: string) {
  console.log(`\n[${slug}] list ${listId}`);
  const tasks = await fetchTasks(listId, apiKey);
  let changed = 0;
  for (const t of tasks) {
    const status = (t.status?.status ?? '').toLowerCase();
    const done = DONE_STATUSES.has(status);
    const updated = await setChecklistItem(slug, t.name, done);
    if (updated) {
      changed++;
      console.log(`  ${done ? '[x]' : '[ ]'} ${t.name}`);
    }
  }
  console.log(`[${slug}] ${tasks.length} tasks, ${changed} checklist updates`);
}

async function main() {
  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    console.error('CLICKUP_API_KEY not set');
    process.exit(1);
  }
  const only = process.argv[2];
  const entries = Object.entries(CLICKUP_LIST_IDS).filter(([slug]) => !only || slug === only);
  for (const [slug, listId] of entries) {
    try {
      await sync(slug, listId, apiKey);
    } catch (e) {
      console.error(`[${slug}] failed`, e);
    }
  }
}

main();
