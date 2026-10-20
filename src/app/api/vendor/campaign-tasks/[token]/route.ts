import { NextRequest, NextResponse } from 'next/server';
import { resolveVendorToken } from '@/lib/vendor-tokens';
import { getRentalSlugForToken } from '@/lib/rental-tokens';
import { CLICKUP_LIST_IDS, CampaignTask } from '@/lib/clickup-config';

// Shared by the vendor and landlord/rental dashboards (CampaignTimeline),
// so a token resolves against either store — never a caller-supplied slug.
function resolveSlugForToken(token: string): string | null {
  return resolveVendorToken(token)?.slug ?? getRentalSlugForToken(token);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const slug = resolveSlugForToken(token);
  if (!slug) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  const listId = CLICKUP_LIST_IDS[slug];
  if (!listId) {
    return NextResponse.json({ tasks: [] });
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ tasks: [] });
  }

  try {
    const url = `https://api.clickup.com/api/v2/list/${listId}/task?statuses%5B%5D=Open&tags%5B%5D=vendor&order_by=due_date`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json({ tasks: [] });
    }

    const data = await res.json();
    const tasks: CampaignTask[] = (data.tasks ?? []).slice(0, 8).map((t: {
      id: string;
      name: string;
      due_date: string | null;
      priority: { priority: string } | null;
    }) => ({
      id: t.id,
      name: t.name,
      dueDate: t.due_date ?? null,
      priority: t.priority?.priority ?? null,
    }));

    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ tasks: [] });
  }
}
