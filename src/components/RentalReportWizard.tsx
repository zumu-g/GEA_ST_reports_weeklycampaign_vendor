'use client';

import { useState } from 'react';
import type { GeneratedReportNarrative, NewsArticle, RentalGenerateInput } from '@/lib/types';

interface ActiveRental {
  id: string;
  address: string;
  landlord: string;
  agent: string;
  rentPw: string;
  listed: string;
}

interface RentalReportWizardProps {
  activeRentals: ActiveRental[];
}

const STEPS = ['Property', 'Portal Stats', 'Applications', 'Inspections', 'Commentary', 'Generate'];

// Sunday ending the most recently completed week (local time, no UTC shift).
function getReportWeekEnding(): string {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, '0');
  const d = String(sunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const BLANK: RentalGenerateInput & { propertyId: string } = {
  propertyId: '',
  propertyAddress: '',
  landlordName: '',
  agent: 'Stuart Grant',
  weekEnding: getReportWeekEnding(),
  leaseType: 'Private Rental',
  rentPw: '',
  daysListed: '0',
  listedDate: '',
  reaViews: '',
  reaEnquiries: '',
  reaSaves: '',
  domainViews: '',
  domainEnquiries: '',
  domainSaves: '',
  applications: '',
  applicationNotes: '',
  openHomeAttendees: '',
  privateInspections: '',
  inspectionNotes: '',
  agentCommentary: '',
  newsArticles: [],
};

export default function RentalReportWizard({ activeRentals }: RentalReportWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(BLANK);
  const [narrative, setNarrative] = useState<GeneratedReportNarrative | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [newNewsUrl, setNewNewsUrl] = useState('');
  const [newNewsTitle, setNewNewsTitle] = useState('');
  const [newNewsNote, setNewNewsNote] = useState('');

  function set(field: string, value: string) {
    setData(d => ({ ...d, [field]: value }));
  }

  function selectRental(id: string) {
    const rental = activeRentals.find(r => r.id === id);
    if (!rental) return;
    const listed = rental.listed ? new Date(rental.listed) : null;
    const daysListed = listed && !isNaN(listed.getTime())
      ? String(Math.floor((Date.now() - listed.getTime()) / 86_400_000))
      : '0';
    setData(d => ({
      ...d,
      propertyId: rental.id,
      propertyAddress: rental.address,
      landlordName: rental.landlord,
      agent: rental.agent || d.agent,
      rentPw: rental.rentPw,
      listedDate: rental.listed,
      daysListed,
    }));
  }

  function addNews() {
    if (!newNewsTitle && !newNewsUrl) return;
    const article: NewsArticle = {
      id: String(Date.now()),
      title: newNewsTitle,
      url: newNewsUrl,
      note: newNewsNote,
    };
    setData(d => ({ ...d, newsArticles: [...d.newsArticles, article] }));
    setNewNewsUrl('');
    setNewNewsTitle('');
    setNewNewsNote('');
  }

  function removeNews(id: string) {
    setData(d => ({ ...d, newsArticles: d.newsArticles.filter(a => a.id !== id) }));
  }

  async function draftCommentary() {
    const apiKey = process.env.NEXT_PUBLIC_MINIMAX_API_KEY;
    const payload = {
      weekEnding: data.weekEnding,
      propertyAddress: data.propertyAddress,
      reaViews: data.reaViews,
      reaEnquiries: data.reaEnquiries,
      domainViews: data.domainViews,
      domainEnquiries: data.domainEnquiries,
      applications: data.applications,
      openHomeAttendees: data.openHomeAttendees,
    };
    try {
      const res = await fetch('/api/draft-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.commentary) set('agentCommentary', json.commentary);
    } catch {
      // Silently ignore — agent can type manually
    }
  }

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/generate-report/rental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setNarrative(json.narrative);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  }

  const inputCls = 'w-full rounded-md border border-border bg-card-bg px-4 py-2.5 font-body text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40';
  const labelCls = 'font-body text-xs font-medium text-muted mb-1 block';
  const gridCls = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => i < step && setStep(i)}
              className={`rounded-full w-7 h-7 flex items-center justify-center text-xs font-medium font-mono transition-colors ${
                i === step ? 'bg-accent text-white' : i < step ? 'bg-accent/20 text-accent cursor-pointer' : 'bg-surface text-muted'
              }`}
            >
              {i + 1}
            </button>
            <span className={`font-body text-sm whitespace-nowrap ${i === step ? 'text-foreground font-medium' : 'text-muted'}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step 0: Property */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Select rental listing</label>
            <select
              className={inputCls}
              value={data.propertyId}
              onChange={e => selectRental(e.target.value)}
            >
              <option value="">— choose a rental —</option>
              {activeRentals.map(r => (
                <option key={r.id} value={r.id}>{r.address}</option>
              ))}
            </select>
          </div>
          <div className={gridCls}>
            <div>
              <label className={labelCls}>Property address</label>
              <input className={inputCls} value={data.propertyAddress} onChange={e => set('propertyAddress', e.target.value)} placeholder="14 Hartsmere Drive, Berwick VIC 3806" />
            </div>
            <div>
              <label className={labelCls}>Landlord name</label>
              <input className={inputCls} value={data.landlordName} onChange={e => set('landlordName', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <label className={labelCls}>Weekly rent</label>
              <input className={inputCls} value={data.rentPw} onChange={e => set('rentPw', e.target.value)} placeholder="$450/wk" />
            </div>
            <div>
              <label className={labelCls}>Agent</label>
              <input className={inputCls} value={data.agent} onChange={e => set('agent', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Lease type</label>
              <select className={inputCls} value={data.leaseType} onChange={e => set('leaseType', e.target.value)}>
                <option>Private Rental</option>
                <option>Open Listing</option>
                <option>Fixed Term</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Week ending</label>
              <input type="date" className={inputCls} value={data.weekEnding} onChange={e => set('weekEnding', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Portal Stats */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <p className="font-body text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> realestate.com.au
            </p>
            <div className={gridCls}>
              <div><label className={labelCls}>Views</label><input className={inputCls} value={data.reaViews} onChange={e => set('reaViews', e.target.value)} placeholder="0" /></div>
              <div><label className={labelCls}>Enquiries</label><input className={inputCls} value={data.reaEnquiries} onChange={e => set('reaEnquiries', e.target.value)} placeholder="0" /></div>
              <div><label className={labelCls}>Saves / Shortlists</label><input className={inputCls} value={data.reaSaves} onChange={e => set('reaSaves', e.target.value)} placeholder="0" /></div>
            </div>
          </div>
          <div>
            <p className="font-body text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> domain.com.au
            </p>
            <div className={gridCls}>
              <div><label className={labelCls}>Views</label><input className={inputCls} value={data.domainViews} onChange={e => set('domainViews', e.target.value)} placeholder="0" /></div>
              <div><label className={labelCls}>Enquiries</label><input className={inputCls} value={data.domainEnquiries} onChange={e => set('domainEnquiries', e.target.value)} placeholder="0" /></div>
              <div><label className={labelCls}>Saves / Shortlists</label><input className={inputCls} value={data.domainSaves} onChange={e => set('domainSaves', e.target.value)} placeholder="0" /></div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Applications */}
      {step === 2 && (
        <div className="space-y-4">
          <div className={gridCls}>
            <div>
              <label className={labelCls}>Applications received this week</label>
              <input className={inputCls} type="number" min="0" value={data.applications} onChange={e => set('applications', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Application notes (quality, conditions, feedback)</label>
            <textarea
              rows={4}
              className={inputCls + ' resize-none'}
              value={data.applicationNotes}
              onChange={e => set('applicationNotes', e.target.value)}
              placeholder="e.g. 2 strong applications — both employed full-time, positive rental references. 1 conditional on lease start date."
            />
          </div>
        </div>
      )}

      {/* Step 3: Inspections */}
      {step === 3 && (
        <div className="space-y-4">
          <div className={gridCls}>
            <div>
              <label className={labelCls}>Open home groups</label>
              <input className={inputCls} type="number" min="0" value={data.openHomeAttendees} onChange={e => set('openHomeAttendees', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Private inspection groups</label>
              <input className={inputCls} type="number" min="0" value={data.privateInspections} onChange={e => set('privateInspections', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Inspection notes</label>
            <textarea
              rows={3}
              className={inputCls + ' resize-none'}
              value={data.inspectionNotes}
              onChange={e => set('inspectionNotes', e.target.value)}
              placeholder="e.g. Strong turnout at Saturday open — 8 groups, mostly young professionals. General positive feedback on condition and location."
            />
          </div>
        </div>
      )}

      {/* Step 4: Commentary */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Agent commentary</label>
              <button onClick={draftCommentary} className="font-body text-xs text-accent hover:underline">
                AI draft
              </button>
            </div>
            <textarea
              rows={5}
              className={inputCls + ' resize-none'}
              value={data.agentCommentary}
              onChange={e => set('agentCommentary', e.target.value)}
              placeholder="Your observations about the week — demand levels, applicant quality, market conditions, next steps..."
            />
          </div>

          {/* News articles */}
          <div>
            <p className={labelCls}>Market news articles (optional)</p>
            {data.newsArticles.map(a => (
              <div key={a.id} className="flex items-start gap-2 mb-2 bg-surface rounded-md px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-foreground truncate">{a.title || a.url}</p>
                  {a.note && <p className="font-body text-xs text-muted mt-0.5">{a.note}</p>}
                </div>
                <button onClick={() => removeNews(a.id)} className="text-muted hover:text-danger text-xs flex-shrink-0">Remove</button>
              </div>
            ))}
            <div className="bg-surface rounded p-4 space-y-3 mt-2">
              <input className={inputCls} value={newNewsTitle} onChange={e => setNewNewsTitle(e.target.value)} placeholder="Article title" />
              <input className={inputCls} value={newNewsUrl} onChange={e => setNewNewsUrl(e.target.value)} placeholder="URL (optional)" />
              <input className={inputCls} value={newNewsNote} onChange={e => setNewNewsNote(e.target.value)} placeholder="Agent note (optional)" />
              <button onClick={addNews} className="rounded-md px-4 py-1.5 text-xs font-medium font-body bg-card-bg border border-border text-foreground hover:border-accent transition-colors">
                Add article
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Generate */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="bg-surface rounded p-5 space-y-2">
            <p className="font-body text-sm font-medium text-foreground">Ready to generate</p>
            <p className="font-body text-xs text-muted">{data.propertyAddress} · w/e {data.weekEnding}</p>
            <p className="font-body text-xs text-muted">
              Views: {(parseInt(data.reaViews||'0')+parseInt(data.domainViews||'0'))} · Enquiries: {(parseInt(data.reaEnquiries||'0')+parseInt(data.domainEnquiries||'0'))} · Applications: {data.applications||'0'}
            </p>
          </div>

          {!narrative && (
            <button
              onClick={generate}
              disabled={generating}
              className="w-full rounded py-3 font-body text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-60 transition-colors"
            >
              {generating ? 'Generating…' : 'Generate Rental Report'}
            </button>
          )}

          {error && <p className="font-body text-sm text-danger">{error}</p>}

          {narrative && (
            <div className="space-y-5 bg-card-bg rounded border border-border p-6">
              <p className="font-body text-sm text-foreground">{narrative.greeting}</p>
              <p className="font-body text-sm text-foreground leading-relaxed">{narrative.openingParagraph}</p>
              <ul className="space-y-1.5">
                {narrative.performanceHighlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 font-body text-sm text-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                    {h}
                  </li>
                ))}
              </ul>
              {[
                { label: 'Portal Analysis', text: narrative.portalAnalysis },
                { label: 'Inspections', text: narrative.inspectionSummary },
                { label: 'Market Context', text: narrative.marketContext },
                { label: 'Agent Insight', text: narrative.agentInsight },
                { label: 'Next Steps', text: narrative.nextSteps },
              ].map(({ label, text }) => (
                <div key={label}>
                  <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">{label}</p>
                  <p className="font-body text-sm text-foreground leading-relaxed">{text}</p>
                </div>
              ))}
              <p className="font-body text-sm text-foreground italic">{narrative.closing}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-md px-5 py-2 font-body text-sm font-medium border border-border text-foreground hover:border-accent disabled:opacity-40 transition-colors"
        >
          Back
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep(s => s + 1)}
            className="rounded-md px-5 py-2 font-body text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
