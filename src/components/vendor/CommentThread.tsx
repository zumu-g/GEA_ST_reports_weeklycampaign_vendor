'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import SectionHeading from '../SectionHeading';

interface Comment {
  id: string;
  ts: string;
  author: 'agent' | 'vendor';
  body: string;
}

// How often to poll for new agent replies while the tab is open.
const POLL_MS = 25_000;

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// Merge server truth with any still-pending optimistic (tmp-) messages, so a
// poll that resolves mid-send never drops the message the vendor just typed.
function mergeComments(prev: Comment[], server: Comment[]): Comment[] {
  const pendingLocal = prev.filter(c => c.id.startsWith('tmp-'));
  return [...server, ...pendingLocal].sort((a, b) =>
    a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0,
  );
}

export default function CommentThread({ token }: { token: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);

  // Refetch the thread and merge into local state. Guarded so overlapping
  // polls / focus events don't stack up concurrent requests.
  const refetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/vendor/comments/${token}`);
      const data = await res.json();
      setComments(prev => mergeComments(prev, data.comments || []));
    } catch {
      // Transient — keep showing what we have; next poll retries.
    } finally {
      setLoaded(true);
      inFlight.current = false;
    }
  }, [token]);

  // Initial load + poll on an interval + immediate refetch when the vendor
  // returns to the tab, so agent replies appear without a manual refresh.
  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (!stopped) refetch();
    };
    tick();
    const interval = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [refetch]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    setDraft('');

    const optimistic: Comment = {
      id: `tmp-${Date.now()}`,
      ts: new Date().toISOString(),
      author: 'vendor',
      body: text,
    };
    setComments(prev => [...prev, optimistic]);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/vendor/comments/${token}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: text }),
        });
        if (!res.ok) throw new Error('Failed to post');
        const data = await res.json();
        setComments(prev => prev.map(c => (c.id === optimistic.id ? data.entry : c)));
      } catch {
        setError('Could not send. Please try again.');
        setComments(prev => prev.filter(c => c.id !== optimistic.id));
        setDraft(text);
      }
    });
  };

  return (
    <section className="mb-12">
      <SectionHeading label="Messages" count={comments.length} />
      <div className="bg-card-bg rounded border border-border">
        <div className="px-5 py-4 max-h-[420px] overflow-y-auto">
          {!loaded && <p className="font-body text-sm text-muted">Loading…</p>}
          {loaded && comments.length === 0 && (
            <p className="font-body text-sm text-muted">
              Send a message to your agent: questions, feedback, or anything else.
            </p>
          )}
          <ul className="space-y-4">
            {comments.map(c => (
              <li key={c.id} className={`flex ${c.author === 'vendor' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                    c.author === 'vendor'
                      ? 'bg-accent/15 text-foreground'
                      : 'bg-background border border-border text-foreground'
                  }`}
                >
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted mb-1">
                    {c.author === 'vendor' ? 'You' : 'Agent'} · {formatTime(c.ts)}
                  </p>
                  <p className="font-body text-sm leading-relaxed whitespace-pre-wrap break-words">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-border p-3">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Write a message to your agent…"
            rows={2}
            className="w-full resize-none rounded border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="font-body text-[10px] text-muted">Press ⌘↩ to send</p>
            {error && <p className="font-body text-[11px] text-red-600">{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={isPending || !draft.trim()}
              className="font-body text-xs font-semibold rounded-md px-4 py-1.5 min-h-[44px] bg-foreground text-background hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
