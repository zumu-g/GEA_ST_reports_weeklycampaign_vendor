'use client';

import { useState } from 'react';

interface FormState {
  address: string;
  owner: string;
  contact: string;
  listed: string;
  priceGuide: string;
  campaignType: string;
}

interface Result {
  slug: string;
  token: string;
  portalUrl: string;
}

function slugify(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function OnboardPage() {
  const [form, setForm] = useState<FormState>({
    address: '',
    owner: '',
    contact: '',
    listed: '',
    priceGuide: '',
    campaignType: 'Private Sale',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const previewSlug = form.address ? slugify(form.address) : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/properties/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create property');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (result) {
      navigator.clipboard.writeText(result.portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const field = (label: string, key: keyof FormState, type = 'text', placeholder = '') => (
    <div>
      <label className="block font-body text-xs text-muted mb-1.5 font-medium uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-md px-4 py-2.5 font-body text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-5 py-12">
        <div className="mb-8">
          <p className="font-body text-xs text-muted uppercase tracking-widest mb-1">Grant Estate Agency</p>
          <h1 className="font-display text-2xl font-medium text-foreground">New Vendor Onboarding</h1>
          <p className="font-body text-sm text-muted mt-1">Creates the property folder, PROPERTY.md, and vendor portal link.</p>
        </div>

        {result ? (
          <div className="bg-card-bg rounded border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <p className="font-body text-sm font-medium text-foreground">Property created successfully</p>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <p className="font-body text-xs text-muted mb-0.5">Slug</p>
                <p className="font-mono text-sm text-foreground">{result.slug}</p>
              </div>
              <div>
                <p className="font-body text-xs text-muted mb-0.5">Vendor portal URL</p>
                <p className="font-mono text-xs text-foreground break-all bg-background rounded-lg px-3 py-2 border border-border">{result.portalUrl}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 bg-foreground text-background font-body text-sm font-medium rounded-md px-4 py-2.5 hover:opacity-90 transition-opacity"
              >
                {copied ? 'Copied!' : 'Copy portal link'}
              </button>
              <button
                onClick={() => { setResult(null); setForm({ address: '', owner: '', contact: '', listed: '', priceGuide: '', campaignType: 'Private Sale' }); }}
                className="font-body text-sm text-muted hover:text-foreground transition-colors px-4 py-2.5"
              >
                Add another
              </button>
            </div>

            {form.contact.includes('@') && (
              <p className="font-body text-xs text-muted mt-4">Welcome email sent to {form.contact} (if RESEND_API_KEY is configured).</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card-bg rounded border border-border p-6 space-y-4">
            {field('Property address', 'address', 'text', '85 Centenary Boulevard, Officer South VIC 3809')}

            {previewSlug && (
              <p className="font-mono text-xs text-muted -mt-2">Slug: {previewSlug}</p>
            )}

            {field('Owner name', 'owner', 'text', 'Vikram Aulakh')}
            {field('Owner email', 'contact', 'email', 'owner@example.com')}
            {field('Listed date', 'listed', 'text', '15 Feb 2026')}
            {field('Price guide', 'priceGuide', 'text', '$680,000 – $720,000')}

            <div>
              <label className="block font-body text-xs text-muted mb-1.5 font-medium uppercase tracking-wide">Campaign type</label>
              <select
                value={form.campaignType}
                onChange={e => setForm(f => ({ ...f, campaignType: e.target.value }))}
                className="w-full bg-background border border-border rounded-md px-4 py-2.5 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              >
                <option>Private Sale</option>
                <option>Auction</option>
                <option>Expression of Interest</option>
                <option>Lease</option>
              </select>
            </div>

            {error && (
              <p className="font-body text-sm text-red-600 bg-red-50 rounded-md px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !form.address || !form.owner}
              className="w-full bg-foreground text-background font-body text-sm font-medium rounded-md px-4 py-3 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? 'Creating…' : 'Create vendor portal'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
