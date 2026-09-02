import type { Benchmark } from '@/lib/benchmarks';
import SectionHeading from '../SectionHeading';

interface BenchmarkComparisonProps {
  benchmarks: Benchmark[];
}

/**
 * Render benchmark comparison: your listing vs suburb median vs price bracket.
 * Shows capture date and source (R6). Returns null if no benchmarks.
 */
export default function BenchmarkComparison({ benchmarks }: BenchmarkComparisonProps) {
  if (!benchmarks || benchmarks.length === 0) return null;

  // Group benchmarks by metric and use the most recent capture
  const uniqueByMetric = new Map<string, Benchmark>();
  for (const b of benchmarks) {
    const existing = uniqueByMetric.get(b.metric);
    if (!existing || b.capturedAt > existing.capturedAt) {
      uniqueByMetric.set(b.metric, b);
    }
  }

  const sorted = Array.from(uniqueByMetric.values());
  if (sorted.length === 0) return null;

  // Use the earliest capture date as the "as of" date
  const captureDate = sorted.reduce((min, b) => (b.capturedAt < min ? b.capturedAt : min), sorted[0].capturedAt).split('T')[0];

  return (
    <section className="mb-12">
      <SectionHeading label="How You Compare" meta={<span className="font-body text-xs text-muted">as of {captureDate}</span>} />

      <div className="space-y-4">
        {sorted.map(b => {
          const suburbLabel = b.suburbMedian !== null ? `Suburb median: ${b.suburbMedian}` : 'Suburb data unavailable';
          const bracketLabel = b.bracketMedian !== null ? `Price bracket median: ${b.bracketMedian}` : 'Bracket data unavailable';

          return (
            <div key={b.metric} className="bg-card-bg rounded border border-border p-5">
              <p className="font-body text-sm font-semibold text-foreground mb-4">{b.metric}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="font-body text-xs text-accent font-medium mb-1">Your Listing</p>
                  <p className="font-mono text-lg font-medium text-foreground tabular-nums">{b.listingValue.toLocaleString()}</p>
                </div>

                {b.suburbMedian !== null && (
                  <div>
                    <p className="font-body text-xs text-muted mb-1">Suburb Median</p>
                    <p className="font-mono text-lg font-medium text-foreground tabular-nums">{b.suburbMedian.toLocaleString()}</p>
                  </div>
                )}

                {b.bracketMedian !== null && (
                  <div>
                    <p className="font-body text-xs text-muted mb-1">Price Bracket</p>
                    <p className="font-mono text-lg font-medium text-foreground tabular-nums">{b.bracketMedian.toLocaleString()}</p>
                  </div>
                )}
              </div>

              <p className="font-body text-[10px] text-muted/60 mt-4 pt-4 border-t border-border">
                {b.source} · {suburbLabel} · {bracketLabel}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
