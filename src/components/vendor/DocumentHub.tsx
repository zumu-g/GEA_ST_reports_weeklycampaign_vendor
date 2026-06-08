'use client';

import { useEffect, useRef, useState } from 'react';
import SectionHeading from '../SectionHeading';

interface Doc {
  id: string;
  filename: string;
  mime: string;
  size: number;
  uploadedBy: 'agent' | 'vendor';
  ts: string;
  label?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentHub({ token }: { token: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/vendor/documents/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setDocs(data.documents || []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/vendor/documents/${token}`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed.');
        return;
      }
      setDocs(prev => [data.document, ...prev]);
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      setError('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const agentDocs = docs.filter(d => d.uploadedBy === 'agent');
  const vendorDocs = docs.filter(d => d.uploadedBy === 'vendor');

  const renderRow = (d: Doc) => (
    <li
      key={d.id}
      className="py-3 border-b border-border last:border-0 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <a
          href={`/api/vendor/documents/${token}/${d.id}`}
          className="font-body text-sm text-foreground hover:text-accent truncate block"
        >
          {d.filename}
        </a>
        <span className="font-body text-xs text-muted">{formatSize(d.size)}</span>
      </div>
      <a
        href={`/api/vendor/documents/${token}/${d.id}`}
        className="font-body text-xs text-accent hover:underline flex-shrink-0 print:hidden"
      >
        Download
      </a>
    </li>
  );

  return (
    <div className="mb-10">
      <SectionHeading
        label="Documents"
        count={docs.length > 0 ? `${docs.length}` : undefined}
      />

      {loaded && docs.length === 0 && (
        <p className="font-body text-sm text-muted mb-4">No documents yet.</p>
      )}

      {agentDocs.length > 0 && (
        <>
          <p className="font-body text-xs uppercase tracking-wide text-muted mt-2 mb-1">
            From your agent
          </p>
          <ul className="mb-4">{agentDocs.map(renderRow)}</ul>
        </>
      )}

      {vendorDocs.length > 0 && (
        <>
          <p className="font-body text-xs uppercase tracking-wide text-muted mt-2 mb-1">
            Your uploads
          </p>
          <ul className="mb-4">{vendorDocs.map(renderRow)}</ul>
        </>
      )}

      {docs.length > 1 && (
        <a
          href={`/api/vendor/documents/${token}/zip`}
          className="inline-block font-body text-xs text-accent hover:underline mb-4 print:hidden"
        >
          Download all (.zip)
        </a>
      )}

      {/* Upload control */}
      <div className="print:hidden mt-2">
        <input
          ref={inputRef}
          type="file"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
          disabled={uploading}
          className="block w-full text-sm text-muted file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-accent file:text-white file:cursor-pointer disabled:opacity-50"
        />
        {uploading && <p className="font-body text-xs text-muted mt-1">Uploading…</p>}
        {error && <p className="font-body text-xs text-red-600 mt-1">{error}</p>}
        <p className="font-body text-[11px] text-muted mt-1">
          PDF, images, Word, Excel, CSV — up to 25 MB.
        </p>
      </div>
    </div>
  );
}
