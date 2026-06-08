import { NextRequest, NextResponse } from 'next/server';
import { getPropertySlugForToken } from '@/lib/vendor-tokens';
import { getDocumentBytes } from '@/lib/markdown-loader';

// GET: download a single document by id. The id must exist in the property's
// document index — the client never supplies a path or stored name.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const slug = getPropertySlugForToken(token);
  if (!slug) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const found = await getDocumentBytes(slug, id);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { meta, bytes } = found;
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': meta.mime || 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(meta.filename)}"`,
    },
  });
}
