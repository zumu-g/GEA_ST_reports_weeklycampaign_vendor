'use client';

import { useState } from 'react';

type SyncState = 'idle' | 'loading' | 'done' | 'error';

export default function SyncVaultREButton({
  onSynced,
}: {
  onSynced?: (data: { created: number; updated: number }) => void;
} = {}) {
  const [state, setState] = useState<SyncState>('idle');
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
  const [error, setError] = useState<string>('');

  async function handleSync() {
    setState('loading');
    setResult(null);
    setError('');
    try {
      const res = await fetch('/api/sync/vaultre', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setResult({ created: data.created, updated: data.updated });
      setState('done');
      onSynced?.({ created: data.created, updated: data.updated });
      // Reload the page after a short pause so new listings appear
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setState('error');
    }
  }

  if (state === 'loading') {
    return (
      <button disabled className="rounded px-4 py-2 text-sm font-medium font-body bg-surface text-muted border border-border cursor-not-allowed">
        Syncing…
      </button>
    );
  }

  if (state === 'done' && result) {
    return (
      <span className="font-body text-xs text-success">
        ✓ {result.created} created, {result.updated} updated
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="font-body text-xs text-danger" title={error}>
        Sync failed — check API key
      </span>
    );
  }

  return (
    <button
      onClick={handleSync}
      className="rounded px-4 py-2 text-sm font-medium font-body text-muted border border-border hover:border-foreground hover:text-foreground transition-colors"
    >
      Sync Listings
    </button>
  );
}
