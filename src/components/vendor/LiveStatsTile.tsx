import { getLiveStats, readOpens } from '@/lib/markdown-loader';
import { nowMs, today } from '@/lib/clock';
import SectionHeading from '@/components/SectionHeading';

function Delta({ value }: { value: number }) {
  if (value === 0) {
    return <span className="font-body text-[10px] text-muted">-</span>;
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

function sourceLabel(source: string): string {
  if (source === 'rea') return 'REA';
  if (source === 'domain') return 'Domain';
  if (source === 'grantsea') return 'Site';
  return source;
}

function relativeAsAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const daysAgo = Math.floor((nowMs() - d.getTime()) / 86_400_000);
  if (daysAgo <= 0) return `as at today, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
  if (daysAgo === 1) return 'as at yesterday';
  return `as at ${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;
}

export default async function LiveStatsTile({
  slug, listed,
}: { slug: string; listed: string }) {
  const [stats, opens] = await Promise.all([getLiveStats(slug), readOpens(slug)]);
  if (!stats) return null;

  const dom = listed
    ? Math.max(0, Math.floor((nowMs() - new Date(listed).getTime()) / 86_400_000))
    : 0;

  const todayStr = today().toISOString().slice(0, 10);
  const groupsToday = opens
    .filter(o => o.start.slice(0, 10) === todayStr)
    .reduce((sum, o) => sum + (o.attendance?.checkins.length ?? 0), 0);
  const hasOpenToday = opens.some(o => o.start.slice(0, 10) === todayStr);

  return (
    <section className="mb-12">
      <SectionHeading
        label="Live Campaign Stats"
        meta={stats.asAt ? <span className="font-body text-xs text-muted">{relativeAsAt(stats.asAt)}</span> : undefined}
      />
      <div className="bg-card-bg rounded border border-border p-5 flex flex-wrap gap-4 sm:gap-6">
        {stats.bySource.map(s => (
          <Stat key={s.source} label={`${sourceLabel(s.source)} Views`} value={s.views} delta={s.viewsDelta} />
        ))}
        {stats.bySource.map(s => (
          <Stat key={`${s.source}-enq`} label={`${sourceLabel(s.source)} Enq.`} value={s.enquiries} delta={s.enquiriesDelta} />
        ))}
        <Stat label="Days on Market" value={dom} />
        {hasOpenToday && <Stat label="Groups Today" value={groupsToday} />}
      </div>
    </section>
  );
}
