'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Doc {
  id: string;
  filename: string;
  size: number;
  uploadedBy: 'agent' | 'vendor';
  ts: string;
}

const KEY_STORAGE = 'gea:agentKey';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Agent-side document management (upload / delete) under /admin. Shares the
// AGENT_API_KEY stored by AgentNotes.
export default function AgentDocuments({ slug }: { slug: string }) {
  const [agentKey, setAgentKey] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORAGE);
      if (saved) setAgentKey(saved);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!agentKey) return;
    setError('');
    try {
      const res = await fetch(`/api/agent/documents/${slug}`, {
        headers: { 'x-agent-key': agentKey },
      });
      if (!res.ok) {
        setError(res.status === 401 ? 'Invalid agent key.' : 'Failed to load documents.');
        return;
      }
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {
      setError('Failed to load documents.');
    }
  }, [agentKey, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    if (!agentKey) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/agent/documents/${slug}`, {
        method: 'POST',
        headers: { 'x-agent-key': agentKey },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed.');
        return;
      }
      if (inputRef.current) inputRef.current.value = '';
      load();
    } catch {
      setError('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!agentKey) return;
    try {
      const res = await fetch(`/api/agent/documents/${slug}?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-agent-key': agentKey },
      });
      if (res.ok) setDocs(prev => prev.filter(d => d.id !== id));
    } catch {}
  };

  return (
    <div className="max-w-2xl mt-10">
      <h2 className="text-lg font-semibold mb-1">Documents — {slug}</h2>
      <p className="text-xs text-muted mb-4">
        Files you upload here are downloadable by the vendor. Vendor uploads also appear below.
      </p>

      <input
        ref={inputRef}
        type="file"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
        disabled={uploading || !agentKey}
        className="block w-full text-sm mb-2 disabled:opacity-50"
      />
      {!agentKey && <p className="text-xs text-muted mb-2">Enter the agent key in the notes panel above first.</p>}
      {uploading && <p className="text-xs text-muted">Uploading…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <ul className="mt-4 space-y-2">
        {docs.map(d => (
          <li key={d.id} className="flex items-center gap-3 border border-border rounded p-2">
            <span className="flex-1 text-sm truncate">
              {d.filename}{' '}
              <span className="text-xs text-muted">
                ({formatSize(d.size)} · {d.uploadedBy})
              </span>
            </span>
            <button
              type="button"
              onClick={() => remove(d.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
        {docs.length === 0 && <li className="text-sm text-muted">No documents yet.</li>}
      </ul>
    </div>
  );
}
