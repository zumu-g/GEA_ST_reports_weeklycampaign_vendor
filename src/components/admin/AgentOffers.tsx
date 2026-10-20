'use client';

import { useEffect, useState } from 'react';

interface Offer {
  id: string;
  buyerId: string;
  amount: number;
  conditions: string;
  status: string;
  vendorAck?: { ts: string; note?: string };
}

interface AgentOffersProps {
  slug: string;
}

const KEY_STORAGE = 'gea:agentKey';

// Agent-only offers panel, mirroring AgentNotes' localStorage agent-key flow.
function readStoredKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export default function AgentOffers({ slug }: AgentOffersProps) {
  const [agentKey, setAgentKey] = useState(readStoredKey);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [buyerFirstName, setBuyerFirstName] = useState('');
  const [amount, setAmount] = useState('');
  const [conditions, setConditions] = useState('');
  const [settlementDays, setSettlementDays] = useState('');
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!agentKey) return;
    let cancelled = false;
    fetch(`/api/agent/offers/${slug}`, { headers: { 'x-agent-key': agentKey } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data) setOffers(data.offers ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [agentKey, slug, reloadToken]);

  const saveKey = (value: string) => {
    setAgentKey(value);
    try { localStorage.setItem(KEY_STORAGE, value); } catch {}
  };

  async function addOffer() {
    if (!agentKey || !buyerFirstName.trim() || !amount) return;
    setError('');
    try {
      const res = await fetch(`/api/agent/offers/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-key': agentKey },
        body: JSON.stringify({
          buyerFirstName: buyerFirstName.trim(),
          amount: Number(amount),
          conditions,
          settlementDays: settlementDays ? Number(settlementDays) : undefined,
        }),
      });
      if (!res.ok) {
        setError('Failed to add offer.');
        return;
      }
      setBuyerFirstName(''); setAmount(''); setConditions(''); setSettlementDays('');
      setReloadToken(t => t + 1);
    } catch {
      setError('Failed to add offer.');
    }
  }

  return (
    <section className="mb-10">
      <h2 className="text-sm font-medium text-muted mb-3">Offers</h2>
      {!agentKey && (
        <input
          type="password"
          placeholder="Agent key"
          className="w-full mb-3 px-3 py-2 border border-border rounded"
          onChange={e => saveKey(e.target.value)}
        />
      )}
      <ul className="space-y-2 mb-4">
        {offers.map(o => (
          <li key={o.id} className="text-sm border border-border rounded p-3">
            ${o.amount.toLocaleString('en-AU')} — {o.status}{o.vendorAck ? ' · acknowledged' : ''}
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <input type="text" placeholder="Buyer first name" value={buyerFirstName} onChange={e => setBuyerFirstName(e.target.value)} className="w-full px-3 py-2 border border-border rounded" />
        <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 border border-border rounded" />
        <input type="text" placeholder="Conditions" value={conditions} onChange={e => setConditions(e.target.value)} className="w-full px-3 py-2 border border-border rounded" />
        <input type="number" placeholder="Settlement days" value={settlementDays} onChange={e => setSettlementDays(e.target.value)} className="w-full px-3 py-2 border border-border rounded" />
        <button onClick={addOffer} className="w-full py-2 bg-primary text-white rounded">Add offer</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
