import { NextRequest, NextResponse } from 'next/server';
import { resolveProperty } from '@/lib/property-registry';
import { writeInspectionFile, appendActivity } from '@/lib/markdown-loader';
import { ingestGuard } from '@/lib/agent-auth';
import { parseArticleBroadcast, parseFreeformNote, parseTelegramMessage } from '@/lib/message-parsers';
import { fetchArticleMeta } from '@/lib/article-meta';
import { broadcastArticleToAllDrafts, getReportWeekEnding } from '@/lib/weekly-drafts';

export async function POST(request: NextRequest) {
  const denied = ingestGuard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Missing message field' }, { status: 400 });
    }

    // Article-broadcast path — checked first, ahead of the note/inspection
    // parsers, since its trigger phrase is far more specific than either.
    const broadcast = parseArticleBroadcast(message);
    if (broadcast) {
      let { title, note } = broadcast;
      if (!title) {
        const meta = await fetchArticleMeta(broadcast.url);
        if (!meta) {
          return NextResponse.json(
            {
              error: 'Could not determine the article title/summary',
              hint: 'Resend with a title and summary line after the link.',
              url: broadcast.url,
            },
            { status: 422 }
          );
        }
        title = meta.title;
        note = meta.note;
      }

      const weekEnding = getReportWeekEnding();
      const { updated, skipped } = await broadcastArticleToAllDrafts(
        { title, url: broadcast.url, note: note || '' },
        weekEnding
      );

      return NextResponse.json({
        success: true,
        kind: 'article-broadcast',
        article: { title, url: broadcast.url, note: note || '' },
        weekEnding,
        updated,
        skipped,
      });
    }

    // Free-form note path — write to activity feed, not inspection log
    const note = parseFreeformNote(message);
    if (note) {
      const property = await resolveProperty(note.propertyText);
      if (!property) {
        return NextResponse.json(
          { error: 'Could not match property', searched: note.propertyText },
          { status: 404 }
        );
      }
      const entry = await appendActivity(property.slug, {
        source: 'telegram',
        actor: body.sender || 'Agent',
        summary: note.note,
      });
      return NextResponse.json({
        success: true,
        kind: 'note',
        property: property.address,
        slug: property.slug,
        entry,
      });
    }

    const parsed = parseTelegramMessage(message);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Could not parse message format', message },
        { status: 400 }
      );
    }

    const property = await resolveProperty(parsed.propertyText);
    if (!property) {
      return NextResponse.json(
        {
          error: 'Could not match property',
          searched: parsed.propertyText,
          hint: 'Use a keyword like "85 Centenary", "Hartsmere", "Calibar", etc.',
        },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const filePath = await writeInspectionFile(property.slug, {
      date: today,
      type: parsed.type,
      groups: parsed.groups,
      interested: parsed.interested,
      interestLevel: parsed.interestLevel,
      notes: parsed.notes,
    });

    return NextResponse.json({
      success: true,
      property: property.address,
      slug: property.slug,
      parsed,
      file: filePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process telegram message', detail: String(error) },
      { status: 500 }
    );
  }
}
