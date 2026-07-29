import { NextRequest, NextResponse } from 'next/server';
import { writeAnalyticsFile, upsertStats } from '@/lib/markdown-loader';
import { ingestGuard } from '@/lib/agent-auth';
import { resolveProperty } from '@/lib/property-registry';
import { parseReportText, isParseFailure } from '@/lib/report-pdf-parser';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ponytail: fixed cap, no config knob — weekly report PDFs are a few hundred KB.
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const denied = ingestGuard(request);
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const propertySlug = formData.get('property') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `PDF exceeds ${MAX_PDF_BYTES / (1024 * 1024)}MB limit` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { default: pdfParse } = await import('pdf-parse');
  const { text } = await pdfParse(buffer);

  const parsed = parseReportText(text);
  if (isParseFailure(parsed)) {
    return NextResponse.json(
      { error: 'Could not extract required fields from PDF', missing: parsed.missing, detectedSource: parsed.detectedSource },
      { status: 422 }
    );
  }

  let slug = propertySlug;
  if (!slug && parsed.address) {
    const resolved = await resolveProperty(parsed.address);
    if (resolved) slug = resolved.slug;
  }
  if (!slug) {
    return NextResponse.json(
      { error: 'Could not determine property — pass "property" (slug) or ensure the PDF address matches a known property', detectedAddress: parsed.address },
      { status: 422 }
    );
  }

  try {
    const filePath = await writeAnalyticsFile(slug, {
      source: parsed.source,
      weekEnding: parsed.weekEnding,
      views: parsed.views,
      enquiries: parsed.enquiries,
      saves: parsed.saves,
      searchAppearances: parsed.searchAppearances,
    });

    await upsertStats(slug, {
      weekEnding: parsed.weekEnding,
      source: parsed.source,
      views: parsed.views,
      enquiries: parsed.enquiries,
      saves: parsed.saves,
    });

    return NextResponse.json({
      success: true,
      slug,
      source: parsed.source,
      weekEnding: parsed.weekEnding,
      file: filePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to ingest report', detail: String(error) },
      { status: 500 }
    );
  }
}
