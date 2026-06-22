import AnimatedNumber from './AnimatedNumber';
import { fieldDisplay } from '@/lib/field-display';
import type { FieldSource } from '@/lib/types';

interface StatCardProps {
  label: string;
  value: number;
  subtitle?: string;
  variant?: 'default' | 'hero';
  /** Previous week's value — when provided (and not null), renders a week-over-week trend pill. */
  previousValue?: number | null;
  /** CRM provenance for this value. When `gap`, renders "Needs entry" instead of the number. */
  fieldSource?: FieldSource;
}

export default function StatCard({ label, value, subtitle, variant = 'default', previousValue, fieldSource }: StatCardProps) {
  const isHero = variant === 'hero';
  const display = fieldDisplay(value, fieldSource);
  return (
    <div className={`bg-card-bg rounded border border-border ${isHero ? 'p-8' : 'p-6'}`}>
      <div className="h-0.5 w-8 bg-accent mb-4 origin-left animate-accent-expand" />
      <p className="eyebrow mb-3">{label}</p>
      {display.isGap ? (
        <p className={`font-body italic text-muted/60 leading-none ${isHero ? 'text-2xl' : 'text-lg'}`}>
          Needs entry
        </p>
      ) : isHero ? (
        <AnimatedNumber
          value={value}
          duration={650}
          className="font-mono font-medium text-foreground tabular-nums leading-none text-5xl"
        />
      ) : (
        <p className="font-mono font-medium text-foreground tabular-nums leading-none text-3xl">
          {value.toLocaleString()}
        </p>
      )}
      {!display.isGap && <TrendPill value={value} previousValue={previousValue} isHero={isHero} />}
      {!display.isGap && display.hint && (
        <p className={`font-body text-muted/50 ${isHero ? 'text-xs mt-2' : 'text-[10px] mt-1'}`}>{display.hint}</p>
      )}
      {subtitle && (
        <p className={`font-body text-muted/70 ${isHero ? 'text-sm mt-2' : 'text-xs mt-1'}`}>{subtitle}</p>
      )}
    </div>
  );
}

function TrendPill({
  value,
  previousValue,
  isHero,
}: {
  value: number;
  previousValue?: number | null;
  isHero: boolean;
}) {
  if (previousValue === undefined || previousValue === null) return null;

  const delta = value - previousValue;
  const isNew = previousValue === 0 && value > 0;
  const pct = previousValue === 0 ? null : Math.round((delta / previousValue) * 100);

  // Tone: up = success, down = danger, flat/new = neutral muted.
  const up = delta > 0;
  const down = delta < 0;
  const tone = isNew
    ? 'bg-foreground/[0.04] text-muted'
    : up
      ? 'bg-success/10 text-success'
      : down
        ? 'bg-danger/10 text-danger'
        : 'bg-foreground/[0.04] text-muted';

  const arrow = up ? '▲' : down ? '▼' : '—';
  const label = isNew
    ? 'New this week'
    : pct === null || pct === 0
      ? 'No change'
      : `${Math.abs(pct)}% vs last week`;

  return (
    <div className={`flex items-center gap-1.5 ${isHero ? 'mt-3' : 'mt-2'}`}>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body font-medium tabular-nums text-[11px] ${tone}`}>
        {!isNew && <span aria-hidden className="text-[8px] leading-none">{arrow}</span>}
        {label}
      </span>
    </div>
  );
}
