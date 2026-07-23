import { NextResponse } from 'next/server';
import { getLivePropertyData } from '@/lib/live-properties';

export async function GET() {
  try {
    const { properties, source, crmError } = await getLivePropertyData();
    return NextResponse.json({ properties, count: properties.length, source, crmError });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load properties', detail: String(error) },
      { status: 500 }
    );
  }
}
