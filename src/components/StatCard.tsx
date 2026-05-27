import AnimatedNumber from './AnimatedNumber';

interface StatCardProps {
  label: string;
  value: number;
  subtitle?: string;
  variant?: 'default' | 'hero';
}

export default function StatCard({ label, value, subtitle, variant = 'default' }: StatCardProps) {
  const isHero = variant === 'hero';
  return (
    <div className={`bg-card-bg rounded border border-border ${isHero ? 'p-8' : 'p-6'}`}>
      <div className="h-0.5 w-8 bg-accent mb-4 origin-left animate-accent-expand" />
      <p className="eyebrow mb-3">{label}</p>
      {isHero ? (
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
      {subtitle && (
        <p className={`font-body text-muted/70 ${isHero ? 'text-sm mt-2' : 'text-xs mt-1'}`}>{subtitle}</p>
      )}
    </div>
  );
}
