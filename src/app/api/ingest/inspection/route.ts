import { NextRequest, NextResponse } from 'next/server';
import { writeInspectionFile } from '@/lib/markdown-loader';
import { ingestGuard } from '@/lib/agent-auth';

export async function POST(request: NextRequest) {
  const denied = ingestGuard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { property, date, type, groups, interested, interestLevel, notes } = body;

    if (!property || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: property (slug), type' },
        { status: 400 }
      );
    }

    const inspectionDate = date || new Date().toISOString().split('T')[0];

    const filePath = await writeInspectionFile(property, {
      date: inspectionDate,
      type,
      groups: Number(groups) || 0,
      interested: Number(interested) || 0,
      interestLevel: interestLevel || '',
      notes: notes || '',
    });

    return NextResponse.json({
      success: true,
      message: `Inspection for ${property} on ${inspectionDate} saved`,
      file: filePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to ingest inspection', detail: String(error) },
      { status: 500 }
    );
  }
}
