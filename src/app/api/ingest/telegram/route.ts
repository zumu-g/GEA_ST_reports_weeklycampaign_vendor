import { NextRequest, NextResponse } from 'next/server';
import { resolveProperty } from '@/lib/property-registry';
import { writeInspectionFile, appendActivity } from '@/lib/markdown-loader';
import { ingestGuard } from '@/lib/agent-auth';

// Splits "85 Centenary | note: spoke to buyer" or "#feed 85 Centenary spoke to buyer"
// into { propertyText, note } if it is a free-form note rather than an inspection.
function parseFreeformNote(message: string): { propertyText: string; note: string; sender?: string } | null {
  const feedTag = message.match(/^\s*#feed\s+(.+)$/i);
  if (feedTag) {
    const rest = feedTag[1].trim();
    // First 2-3 words are the property keyword
    const m = rest.match(/^(\S+(?:\s+\S+){0,2})\s+(.+)$/);
    if (!m) return null;
    return { propertyText: m[1], note: m[2].trim() };
  }

  // Pipe form: "85 Centenary | note: ..."
  if (message.includes('|')) {
    const parts = message.split('|').map(p => p.trim());
    if (parts.length >= 2 && /^note\s*:/i.test(parts[1])) {
      const note = parts[1].replace(/^note\s*:\s*/i, '');
      const extra = parts.slice(2).join(' | ').trim();
      return { propertyText: parts[0], note: extra ? `${note} — ${extra}` : note };
    }
  }

  // Colon form: "85 Centenary: note: ..."
  const colonMatch = message.match(/^([^:]+):\s*note\s*:\s*(.+)$/i);
  if (colonMatch) {
    return { propertyText: colonMatch[1].trim(), note: colonMatch[2].trim() };
  }

  return null;
}

// Parses telegram shorthand:
// "85 Centenary | open | 3 groups | 1 interested | felt overpriced"
// "14 Hartsmere: private, John Smith, very keen, wants 2nd look"

function parseTelegramMessage(message: string): {
  propertyText: string;
  type: string;
  groups: number;
  interested: number;
  interestLevel: string;
  notes: string;
} | null {
  // Try pipe-delimited format first
  if (message.includes('|')) {
    const parts = message.split('|').map(p => p.trim());
    if (parts.length < 2) return null;

    const propertyText = parts[0];
    const type = parts[1] || 'open';
    const groupsMatch = (parts[2] || '').match(/(\d+)/);
    const interestedMatch = (parts[3] || '').match(/(\d+)/);

    return {
      propertyText,
      type: type.toLowerCase().includes('private') ? 'Private Inspection' : 'Open Home',
      groups: groupsMatch ? parseInt(groupsMatch[1], 10) : 0,
      interested: interestedMatch ? parseInt(interestedMatch[1], 10) : 0,
      interestLevel: interestedMatch
        ? parseInt(interestedMatch[1], 10) > 2 ? 'High' : parseInt(interestedMatch[1], 10) > 0 ? 'Medium' : 'Low'
        : 'Low',
      notes: parts.slice(4).join(', ') || '',
    };
  }

  // Try colon/comma format: "14 Hartsmere: private, 3 groups, 1 interested, notes"
  const colonSplit = message.split(/[:]/);
  if (colonSplit.length >= 2) {
    const propertyText = colonSplit[0].trim();
    const rest = colonSplit.slice(1).join(':').trim();
    const parts = rest.split(',').map(p => p.trim());

    const type = parts[0] || 'open';
    const groupsMatch = rest.match(/(\d+)\s*group/i);
    const interestedMatch = rest.match(/(\d+)\s*interest/i);

    return {
      propertyText,
      type: type.toLowerCase().includes('private') ? 'Private Inspection' : 'Open Home',
      groups: groupsMatch ? parseInt(groupsMatch[1], 10) : 0,
      interested: interestedMatch ? parseInt(interestedMatch[1], 10) : 0,
      interestLevel: rest.toLowerCase().includes('keen') || rest.toLowerCase().includes('strong')
        ? 'High'
        : rest.toLowerCase().includes('soft') || rest.toLowerCase().includes('low')
          ? 'Low'
          : 'Medium',
      notes: parts.slice(1).join(', '),
    };
  }

  // Try dash format: "Calibar - open - 5 groups"
  const dashParts = message.split('-').map(p => p.trim());
  if (dashParts.length >= 2) {
    const propertyText = dashParts[0];
    const type = dashParts[1] || 'open';
    const groupsMatch = message.match(/(\d+)\s*group/i);
    const interestedMatch = message.match(/(\d+)\s*interest/i);

    return {
      propertyText,
      type: type.toLowerCase().includes('private') ? 'Private Inspection' : 'Open Home',
      groups: groupsMatch ? parseInt(groupsMatch[1], 10) : 0,
      interested: interestedMatch ? parseInt(interestedMatch[1], 10) : 0,
      interestLevel: 'Medium',
      notes: dashParts.slice(2).join(', '),
    };
  }

  return null;
}

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
