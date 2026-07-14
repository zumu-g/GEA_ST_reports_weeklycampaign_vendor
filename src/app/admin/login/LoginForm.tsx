'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Invalid key');
      }
      const next = searchParams.get('next') || '/admin/onboard';
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm px-5">
        <div className="mb-8 text-center">
          <p className="font-body text-xs text-muted uppercase tracking-widest mb-1">Grant Estate Agency</p>
          <h1 className="font-display text-2xl font-medium text-foreground">Agent Login</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-card-bg rounded border border-border p-6 space-y-4">
          <div>
            <label className="block font-body text-xs text-muted mb-1.5 font-medium uppercase tracking-wide">
              Access Key
            </label>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              autoFocus
              required
              className="w-full bg-background border border-border rounded-md px-4 py-2.5 font-body text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
            />
          </div>

          {error && (
            <p className="font-body text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !key}
            className="w-full bg-accent text-white rounded-md px-4 py-2.5 font-body text-sm font-medium disabled:opacity-50 active:scale-[0.97] transition-all"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
