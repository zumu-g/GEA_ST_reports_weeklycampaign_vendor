'use client';

import { useEffect, useState } from 'react';

interface CheckinPanelProps {
  slug: string;
  openId: string;
}

const KEY_STORAGE = 'gea:agentKey';

export default function CheckinPanel({ slug, openId }: CheckinPanelProps) {
  const [agentKey, setAgentKey] = useState('');
  const [groups, setGroups] = useState(0);
  const [status, setStatus] = useState<'scheduled' | 'open' | 'closed'>('scheduled');
  const [showBuyerForm, setShowBuyerForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORAGE);
      if (saved) setAgentKey(saved);
    } catch {}
  }, []);

  const saveKey = (value: string) => {
    setAgentKey(value);
    try { localStorage.setItem(KEY_STORAGE, value); } catch {}
  };

  async function send(body: Record<string, unknown>) {
    if (!agentKey) {
      setError('Enter your agent key first.');
      return null;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/agent/opens/${slug}/${openId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Request failed');
        return null;
      }
      setGroups(data.open.attendance?.checkins.length ?? 0);
      setStatus(data.open.attendance?.status ?? 'scheduled');
      return data.open;
    } catch {
      setError('Request failed');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckin() {
    await send({ action: 'checkin' });
  }

  async function handleAddBuyer() {
    if (!firstName.trim()) return;
    await send({ action: 'checkin', firstName: firstName.trim(), position });
    setFirstName('');
    setPosition('');
    setShowBuyerForm(false);
  }

  async function handleUndo() {
    await send({ action: 'undo' });
  }

  async function handleClose() {
    if (!confirm('Close this open home? This logs the inspection and cannot be undone.')) return;
    await send({ action: 'close' });
  }

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      {!agentKey && (
        <input
          type="password"
          placeholder="Agent key"
          className="w-full mb-6 px-4 py-2 border border-border rounded"
          onChange={e => saveKey(e.target.value)}
        />
      )}

      <p className="font-mono text-7xl font-semibold tabular-nums mb-2">{groups}</p>
      <p className="text-sm text-muted uppercase tracking-widest mb-8">
        {status === 'closed' ? 'Closed' : 'Groups through the door'}
      </p>

      {status !== 'closed' && (
        <div className="flex gap-3 justify-center mb-6">
          <button
            onClick={handleCheckin}
            disabled={busy}
            className="flex-1 py-4 bg-primary text-white rounded text-lg font-medium disabled:opacity-50"
          >
            + Group
          </button>
          <button
            onClick={handleUndo}
            disabled={busy || groups === 0}
            className="px-5 py-4 border border-border rounded disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      )}

      {status !== 'closed' && !showBuyerForm && (
        <button onClick={() => setShowBuyerForm(true)} className="text-sm underline text-muted mb-8 block mx-auto">
          + Add interested buyer
        </button>
      )}

      {status !== 'closed' && showBuyerForm && (
        <div className="mb-8 text-left space-y-2">
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded"
          />
          <input
            type="text"
            placeholder="Position (e.g. finance approved, cash)"
            value={position}
            onChange={e => setPosition(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded"
          />
          <button onClick={handleAddBuyer} disabled={busy} className="w-full py-2 bg-primary text-white rounded disabled:opacity-50">
            Check in buyer
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {status !== 'closed' ? (
        <button onClick={handleClose} disabled={busy} className="text-sm underline text-muted disabled:opacity-50">
          Close open
        </button>
      ) : (
        <p className="text-sm text-muted">Inspection logged.</p>
      )}
    </div>
  );
}
