import { NextRequest, NextResponse } from 'next/server';
import { getPropertySlugForToken } from '@/lib/vendor-tokens';
import { readDocuments, getDocumentBytes } from '@/lib/markdown-loader';
import { buildZip, ZipEntry } from '@/lib/documents';

// GET: download all documents for the property as a single zip.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const slug = getPropertySlugForToken(token);
  if (!slug) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const docs = await readDocuments(slug);
  if (docs.length === 0) {
    return NextResponse.json({ error: 'No documents' }, { status: 404 });
  }

  const entries: ZipEntry[] = [];
  const usedNames = new Set<string>();
  for (const doc of docs) {
    const found = await getDocumentBytes(slug, doc.id);
    if (!found) continue;
    // De-dupe filenames inside the archive.
    let name = doc.filename;
    let n = 1;
    while (usedNames.has(name)) {
      const dot = doc.filename.lastIndexOf('.');
      name =
        dot === -1
          ? `${doc.filename} (${n})`
          : `${doc.filename.slice(0, dot)} (${n})${doc.filename.slice(dot)}`;
      n++;
    }
    usedNames.add(name);
    entries.push({ name, data: found.bytes });
  }

  const zip = buildZip(entries);
  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(zip.length),
      'Content-Disposition': `attachment; filename="${slug}-documents.zip"`,
    },
  });
}
