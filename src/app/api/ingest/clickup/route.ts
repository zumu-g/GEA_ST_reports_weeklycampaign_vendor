import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSlugForListId } from '@/lib/clickup-config';
import {
  appendActivity,
  ActivitySource,
  setChecklistItem,
  upsertOpen,
  removeOpen,
} from '@/lib/markdown-loader';

function hasTag(task: ClickUpTaskPayload | undefined, name: string): boolean {
  if (!task?.tags) return false;
  return task.tags.some(t => (typeof t === 'string' ? t : t?.name)?.toLowerCase() === name);
}

function toIso(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  if (Number.isFinite(n)) return new Date(n).toISOString();
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function durationMin(task: ClickUpTaskPayload | undefined): number {
  const f = task?.custom_fields?.find(c => c.name?.toLowerCase() === 'duration_min');
  const n = Number(f?.value);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

const DONE_STATUSES = new Set(['complete', 'completed', 'closed', 'done']);

function statusFromHistory(history?: ClickUpHistoryItem[]): string | undefined {
  const change = history?.find(h => h.field === 'status');
  const after = change?.after;
  if (!after) return undefined;
  return typeof after === 'object' ? after.status : after;
}

interface ClickUpHistoryItem {
  field?: string;
  before?: { status?: string } | string | null;
  after?: { status?: string } | string | null;
}

interface ClickUpTaskPayload {
  id?: string;
  name?: string;
  status?: { status?: string } | string;
  list?: { id?: string };
  url?: string;
  tags?: Array<{ name?: string } | string>;
  start_date?: string | number | null;
  due_date?: string | number | null;
  custom_fields?: Array<{ name?: string; value?: unknown }>;
}

interface ClickUpWebhookBody {
  event?: string;
  task_id?: string;
  history_items?: ClickUpHistoryItem[];
  task?: ClickUpTaskPayload;
  list_id?: string;
}

function summarise(event: string, body: ClickUpWebhookBody): { summary: string; actor: string } {
  const name = body.task?.name || body.task_id || 'a task';
  switch (event) {
    case 'taskCreated':
      return { summary: `New task created: ${name}`, actor: 'ClickUp' };
    case 'taskStatusUpdated': {
      const change = body.history_items?.find(h => h.field === 'status');
      const after = typeof change?.after === 'object' && change?.after ? change.after.status : change?.after;
      return { summary: `${name} → ${after || 'updated'}`, actor: 'ClickUp' };
    }
    case 'taskDeleted':
      return { summary: `Task removed: ${name}`, actor: 'ClickUp' };
    case 'taskCommentPosted':
      return { summary: `Comment posted on ${name}`, actor: 'ClickUp' };
    case 'taskUpdated':
      return { summary: `${name} updated`, actor: 'ClickUp' };
    default:
      return { summary: `${event}: ${name}`, actor: 'ClickUp' };
  }
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET;
  const raw = await request.text();

  if (secret) {
    const sig = request.headers.get('x-signature');
    if (!verifySignature(raw, sig, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let body: ClickUpWebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const listId = body.task?.list?.id || body.list_id;
  if (!listId) {
    return NextResponse.json({ skipped: true, reason: 'no list id' });
  }

  const slug = getSlugForListId(listId);
  if (!slug) {
    return NextResponse.json({ skipped: true, reason: 'list not mapped to a property' });
  }

  const event = body.event || 'taskUpdated';
  const { summary, actor } = summarise(event, body);

  const entry = await appendActivity(slug, {
    source: 'clickup' as ActivitySource,
    actor,
    summary,
    meta: {
      event,
      taskId: body.task_id || body.task?.id,
      taskName: body.task?.name,
      url: body.task?.url,
    },
  });

  let checklistUpdated = false;
  const taskName = body.task?.name;
  if (taskName) {
    const newStatus = statusFromHistory(body.history_items)
      ?? (typeof body.task?.status === 'object' ? body.task.status?.status : body.task?.status);
    if (event === 'taskStatusUpdated' && newStatus && DONE_STATUSES.has(newStatus.toLowerCase())) {
      checklistUpdated = await setChecklistItem(slug, taskName, true);
    } else if (event === 'taskStatusUpdated' && newStatus) {
      checklistUpdated = await setChecklistItem(slug, taskName, false);
    }
  }

  let opensUpdated = false;
  if (hasTag(body.task, 'open-home') && body.task?.id) {
    if (event === 'taskDeleted') {
      await removeOpen(slug, body.task.id);
      opensUpdated = true;
    } else {
      const start = toIso(body.task.start_date) ?? toIso(body.task.due_date);
      if (start) {
        const end = new Date(new Date(start).getTime() + durationMin(body.task) * 60_000).toISOString();
        await upsertOpen(slug, {
          id: body.task.id,
          start,
          end,
          source: 'clickup',
          note: body.task.name,
        });
        opensUpdated = true;
      }
    }
  }

  return NextResponse.json({ success: true, slug, entry, checklistUpdated, opensUpdated });
}
