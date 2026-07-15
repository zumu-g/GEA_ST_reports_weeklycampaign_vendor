import { NextRequest, NextResponse } from 'next/server';
import { resolveProperty } from '@/lib/property-registry';
import { writeInspectionFile, appendActivity } from '@/lib/markdown-loader';
import { ingestGuard } from '@/lib/agent-auth';
import { parseFreeformNote, parseTelegramMessage } from '@/lib/message-parsers';

export async function POST(request: NextRequest) {
  const denied = ingestGuard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Missing message field' }, { status: 400 });
    }

    // Free-form note path — write to activity feed, not inspection log
    const note = parseFreeformNote(message);
    if (note) {
      const property = resolveProperty(note.propertyText);
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

    const property = resolveProperty(parsed.propertyText);
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
