import { NextRequest, NextResponse } from 'next/server';
import { authorised } from '@/lib/agent-auth';
import { generateAllWeeklyDrafts, getReportWeekEnding } from '@/lib/weekly-drafts';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Weekly cron (Railway, Monday 07:00 AEST): creates this week's drafts for
// every listing, pre-filled from the GEA CRM (which owns the REA + Domain
// ingestion). Drafts still need agent approval before the vendor sees them.
export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const weekEnding = getReportWeekEnding();
  const result = await generateAllWeeklyDrafts(weekEnding);
  return NextResponse.json({ weekEnding, ...result });
}
