import { NextRequest, NextResponse } from 'next/server';
import { generateAllWeeklyDrafts, getReportWeekEnding } from '@/lib/weekly-drafts';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const weekEnding: string = body.weekEnding || getReportWeekEnding();

  const result = await generateAllWeeklyDrafts(weekEnding);
  return NextResponse.json(result);
}
