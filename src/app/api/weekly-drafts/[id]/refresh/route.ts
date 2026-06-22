import { NextRequest, NextResponse } from 'next/server';
import {
  parseWeeklyDraftId,
  getWeeklyDraft,
  saveWeeklyDraft,
  enrichDraftFromCrm,
} from '@/lib/weekly-drafts';

interface Params { params: Promise<{ id: string }> }

// POST /api/weekly-drafts/[id]/refresh — re-pull CRM data for one draft.
// Agent-edited fields are preserved (the mapper skips them). CRM failure leaves
// the draft intact with gap markers rather than erroring.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = parseWeeklyDraftId(id);
  if (!parsed) return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 });

  const existing = await getWeeklyDraft(parsed.slug, parsed.weekEnding);
  if (!existing) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  const refreshed = await enrichDraftFromCrm(existing);
  await saveWeeklyDraft(refreshed);

  return NextResponse.json(refreshed);
}
