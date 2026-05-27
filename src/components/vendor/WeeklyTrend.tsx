import type { AnalyticsRow } from '@/lib/markdown-loader';
import SectionHeading from '@/components/SectionHeading';

interface Series {
  label: string;
  // chronological values (oldest → newest)
  values: number[];
}

const W = 280;
const H = 64;
const PAD = 6;

/** Build an SVG polyline path for a series, scaled to the chart box. */
function path(values: number[]): { line: string; dot: { x: number; y: number } | null } {
  if (values.length === 0) return { line: '', dot: null };
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;

  const pts = values.map((v, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return { x, y };
  });

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return { line, dot: pts[pts.length - 1] ?? null };
}

function Sparkline({ series }: { series: Series }) {
  const { line, dot } = path(series.values);
  const latest = series.values[series.values.length - 1] ?? 0;
  const first = series.values[0] ?? 0;
  const delta = latest - first;

  return (
    <div className="bg-card-bg rounded border border-border p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-body text-xs uppercase tracking-widest text-muted">{series.label}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-medium text-foreground tabular-nums">
            {latest.toLocaleString()}
          </span>
          {delta !== 0 && series.values.length > 1 && (
            <span className={`font-mono text-xs tabular-nums ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {delta > 0 ? `↑ +${delta.toLocaleString()}` : `↓ −${Math.abs(delta).toLocaleString()}`}
            </span>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-16"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${series.label} trend over ${series.values.length} weeks`}
      >
        <path className="stroke-accent" d={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {dot && <circle className="fill-accent" cx={dot.x} cy={dot.y} r={3} />}
      </svg>
    </div>
  );
}

/**
 * Multi-week trend of combined REA + Domain Views and Enquiries.
 * `analytics` arrives newest-first (PROPERTY.md table order); we reverse to
 * chronological so the line reads left → right. Renders nothing with < 2 weeks.
 */
export default function WeeklyTrend({ analytics }: { analytics: AnalyticsRow[] }) {
  if (analytics.length < 2) return null;

  const weeks = [...analytics].reverse();
  const views: Series = {
    label: 'Total Views',
    values: weeks.map(w => w.reaViews + w.domainViews),
  };
  const enquiries: Series = {
    label: 'Buyer Enquiries',
    values: weeks.map(w => w.reaEnquiries + w.domainEnquiries),
  };

  const firstWeek = weeks[0]?.weekEnding;
  const lastWeek = weeks[weeks.length - 1]?.weekEnding;

  return (
    <section className="mb-12">
      <SectionHeading
        label="Weekly Trend"
        meta={<span className="font-body text-xs text-muted">{weeks.length} weeks · {firstWeek} → {lastWeek}</span>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Sparkline series={views} />
        <Sparkline series={enquiries} />
      </div>
    </section>
  );
}
