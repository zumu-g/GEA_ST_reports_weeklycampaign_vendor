import { NextRequest, NextResponse } from 'next/server';
import { writeAnalyticsFile, upsertStats } from '@/lib/markdown-loader';
import { ingestGuard } from '@/lib/agent-auth';

export async function POST(request: NextRequest) {
  const denied = ingestGuard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { property, source, weekEnding, views, enquiries, saves, searchAppearances } = body;

    if (!property || !source || !weekEnding) {
      return NextResponse.json(
        { error: 'Missing required fields: property (slug), source, weekEnding' },
        { status: 400 }
      );
    }

    const filePath = await writeAnalyticsFile(property, {
      source,
      weekEnding,
      views: Number(views) || 0,
      enquiries: Number(enquiries) || 0,
      saves: Number(saves) || 0,
      searchAppearances: Number(searchAppearances) || 0,
    });

    await upsertStats(property, {
      weekEnding,
      source,
      views: Number(views) || 0,
      enquiries: Number(enquiries) || 0,
      saves: Number(saves) || 0,
    });

    return NextResponse.json({
      success: true,
      message: `Analytics for ${property} (${source}) week ending ${weekEnding} saved`,
      file: filePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to ingest analytics', detail: String(error) },
      { status: 500 }
    );
  }
}
