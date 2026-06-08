'use client';

import { useCallback, useEffect, useState } from 'react';

interface Note {
  id: string;
  ts: string;
  author: string;
  body: string;
}

interface AgentNotesProps {
  slug: string;
}

const KEY_STORAGE = 'gea:agentKey';

// Agent-only private notes panel. Lives under /admin and authenticates against
// AGENT_API_KEY (entered once, kept in localStorage on the agent's device).
export default function AgentNotes({ slug }: AgentNotesProps) {
  const [agentKey, setAgentKey] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const res = await fetch(`/api/agent/notes/${slug}`, {
        headers: { 'x-agent-key': agentKey },
      });
      if (res.status === 401) {
        setError('Invalid agent key.');
        return;
      }
      if (!res.ok) {
        setError('Failed to load notes.');
        return;
      }
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch {
      setError('Failed to load notes.');
    }
  }, [agentKey, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const saveKey = (value: string) => {
    setAgentKey(value);
    try {
      localStorage.setItem(KEY_STORAGE, value);
    } catch {}
  };

  const submit = async () => {
    const text = body.trim();
    if (!text || !agentKey) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/agent/notes/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? 'Invalid agent key.' : 'Failed to save note.');
        return;
      }
      const data = await res.json();
      setNotes(prev => [data.entry, ...prev]);
      setBody('');
    } catch {
      setError('Failed to save note.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-1">Private notes — {slug}</h2>
      <p className="text-xs text-muted mb-4">
        Agent-only. These notes are never shown to the vendor.
      </p>

      <label className="block text-xs text-muted mb-1">Agent key</label>
      <input
        type="password"
        value={agentKey}
        onChange={e => saveKey(e.target.value)}
        placeholder="AGENT_API_KEY"
        className="w-full border border-border rounded px-3 py-2 mb-4 text-sm"
      />

      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Add a private note…"
        rows={3}
        className="w-full border border-border rounded px-3 py-2 text-sm mb-2"
      />
      <button
        type="button"
        onClick={submit}
        disabled={loading || !body.trim() || !agentKey}
        className="bg-accent text-white text-sm rounded px-4 py-2 disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Add note'}
      </button>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      <ul className="mt-6 space-y-3">
        {notes.map(n => (
          <li key={n.id} className="border border-border rounded p-3">
            <p className="text-sm whitespace-pre-wrap">{n.body}</p>
            <p className="text-[11px] text-muted mt-1">
              {n.author} · {new Date(n.ts).toLocaleString('en-AU')}
            </p>
          </li>
        ))}
        {notes.length === 0 && (
          <li className="text-sm text-muted">No notes yet.</li>
        )}
      </ul>
    </div>
  );
}
