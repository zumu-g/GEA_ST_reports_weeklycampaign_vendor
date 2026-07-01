import { NextRequest, NextResponse } from 'next/server';
import { appendDocument, readDocuments, removeDocument } from '@/lib/markdown-loader';
import { validateUpload, sanitiseFilename, generateStoredName } from '@/lib/documents';
import { authorised } from '@/lib/agent-auth';

// POST: agent uploads a document (multipart/form-data, field `file`).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;

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
  const entry = await appendDocument(
    slug,
    {
      filename: sanitiseFilename(file.name),
      storedName: generateStoredName(check.ext),
      mime: file.type,
      size: file.size,
      uploadedBy: 'agent',
      label: String(form.get('label') || '') || undefined,
    },
    bytes,
  );

  return NextResponse.json({ success: true, document: entry });
}

// DELETE: agent removes a document. ?id=<docId>
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const removed = await removeDocument(slug, id);
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}

// GET: agent lists documents (full metadata).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const { slug } = await params;
  const documents = await readDocuments(slug);
  return NextResponse.json({ documents });
}
