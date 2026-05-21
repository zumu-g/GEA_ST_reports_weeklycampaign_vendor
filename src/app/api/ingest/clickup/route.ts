import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSlugForListId } from '@/lib/clickup-config';
import { appendActivity, ActivitySource } from '@/lib/markdown-loader';

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

  return NextResponse.json({ success: true, slug, entry });
}
