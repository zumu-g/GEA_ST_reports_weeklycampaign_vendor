import { getLiveStats } from '@/lib/markdown-loader';
import SectionHeading from '@/components/SectionHeading';

function Delta({ value }: { value: number }) {
  if (value === 0) {
    return <span className="font-body text-[10px] text-muted">—</span>;
  }
  const up = value > 0;
  return (
    <span
      className={`font-body text-[10px] ${up ? 'text-emerald-600' : 'text-red-600'}`}
    >
      {up ? '↑' : '↓'}
      {Math.abs(value)}
    </span>
  );
}

function Stat({
  label, value, delta,
}: { label: string; value: number; delta?: number }) {
  return (
    <div className="flex-1 min-w-0 text-center">
      <p className="eyebrow mb-1">{label}</p>
      <p className="font-mono text-2xl font-medium text-foreground tabular-nums">{value}</p>
      {delta !== undefined && (
        <div className="mt-1">
          <Delta value={delta} />
        </div>
      )}
    </div>
  );
}

function relativeWeek(weekEnding: string): string {
  const d = new Date(weekEnding);
  if (isNaN(d.getTime())) return weekEnding;
  return `week ending ${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;
}

export default async function LiveStatsTile({
  slug, listed,
}: { slug: string; listed: string }) {
  const stats = await getLiveStats(slug);
  if (!stats) return null;

  const dom = listed
    ? Math.max(0, Math.floor((Date.now() - new Date(listed).getTime()) / 86_400_000))
    : 0;

  return (
    <section className="mb-12">
      <SectionHeading
        label="Last 7 Days"
        meta={stats.weekEnding ? <span className="font-body text-xs text-muted">{relativeWeek(stats.weekEnding)}</span> : undefined}
      />
      <div className="bg-card-bg rounded border border-border p-5 flex flex-wrap gap-4 sm:gap-6">
        <Stat label="REA Views" value={stats.reaViews} delta={stats.reaViewsDelta} />
        <Stat label="REA Enquiries" value={stats.reaEnquiries} delta={stats.reaEnquiriesDelta} />
        <Stat label="Domain Views" value={stats.domainViews} delta={stats.domainViewsDelta} />
        <Stat label="Domain Enq." value={stats.domainEnquiries} delta={stats.domainEnquiriesDelta} />
        <Stat label="Days on Market" value={dom} />
      </div>
    </section>
  );
}
