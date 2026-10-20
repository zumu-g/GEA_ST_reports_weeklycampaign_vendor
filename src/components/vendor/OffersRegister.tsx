'use client';

import { useCallback, useEffect, useState } from 'react';
import SectionHeading from '../SectionHeading';

interface VendorOffer {
  id: string;
  buyerDisplayName: string;
  amount: number;
  conditions: string;
  settlementDays?: number;
  status: string;
  acknowledged: boolean;
  created: string;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function OffersRegister({ token }: { token: string }) {
  const [offers, setOffers] = useState<VendorOffer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vendor/offers/${token}`);
      const data = await res.json();
      setOffers(data.offers ?? []);
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function acknowledge(offerId: string) {
    setBusyId(offerId);
    setOffers(prev => prev.map(o => (o.id === offerId ? { ...o, acknowledged: true } : o)));
    try {
      await fetch(`/api/vendor/offers/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offerId }),
      });
    } finally {
      setBusyId(null);
    }
  }

  if (!loaded || offers.length === 0) return null;

  return (
    <section className="mb-12">
      <SectionHeading label="Offers" count={offers.length} />
      <ul className="space-y-3">
        {offers.map(o => (
          <li key={o.id} className="bg-card-bg rounded border border-border p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-mono text-2xl font-medium text-foreground tabular-nums">
                  ${o.amount.toLocaleString('en-AU')}
                </p>
                <p className="font-body text-xs text-muted">
                  {o.buyerDisplayName} · {formatDate(o.created)} · {o.status}
                </p>
              </div>
            </div>
            {o.conditions && <p className="font-body text-sm text-foreground mb-2">{o.conditions}</p>}
            {o.settlementDays && (
              <p className="font-body text-xs text-muted mb-3">{o.settlementDays}-day settlement</p>
            )}
            {o.acknowledged ? (
              <p className="font-body text-xs text-muted">Acknowledged — your agent will call to discuss.</p>
            ) : (
              <button
                onClick={() => acknowledge(o.id)}
                disabled={busyId === o.id}
                className="font-body text-sm underline text-accent disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
            <p className="font-body text-[10px] text-muted mt-2">
              Acknowledging lets your agent know you&apos;ve seen this — it is not acceptance.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
