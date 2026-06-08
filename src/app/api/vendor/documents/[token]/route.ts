import { NextRequest, NextResponse } from 'next/server';
import { getPropertySlugForToken } from '@/lib/vendor-tokens';
import { appendDocument, readDocuments, appendActivity } from '@/lib/markdown-loader';
import { validateUpload, sanitiseFilename, generateStoredName } from '@/lib/documents';

// GET: list documents for the vendor's property.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const slug = getPropertySlugForToken(token);
  if (!slug) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const docs = await readDocuments(slug);
  // Do not leak storedName / disk details to the client.
  const list = docs.map(({ id, filename, mime, size, uploadedBy, ts, label }) => ({
    id,
    filename,
    mime,
    size,
    uploadedBy,
    ts,
    label,
  }));
  return NextResponse.json({ documents: list });
}

// POST: vendor uploads a document. multipart/form-data with field `file`.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const slug = getPropertySlugForToken(token);
  if (!slug) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const check = validateUpload(file.type, file.size);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = sanitiseFilename(file.name);
  const entry = await appendDocument(
    slug,
    {
      filename,
      storedName: generateStoredName(check.ext),
      mime: file.type,
      size: file.size,
      uploadedBy: 'vendor',
      label: String(form.get('label') || '') || undefined,
    },
    bytes,
  );

  // Vendor uploads are not private — surface to the agent via the activity feed.
  await appendActivity(slug, {
    source: 'comment',
    actor: 'Vendor',
    summary: `Vendor uploaded document: ${filename}`,
  });

  return NextResponse.json({
    success: true,
    document: {
      id: entry.id,
      filename: entry.filename,
      mime: entry.mime,
      size: entry.size,
      uploadedBy: entry.uploadedBy,
      ts: entry.ts,
      label: entry.label,
    },
  });
}
