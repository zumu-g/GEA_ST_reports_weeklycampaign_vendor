import type { AnalyticsRow } from '@/lib/markdown-loader';
import SectionHeading from '../SectionHeading';

interface CompetitionContextProps {
  analytics: AnalyticsRow[];
}

/**
 * Display competing listings count and context for the latest week.
 * Returns null if no competing listings data.
 */
export default function CompetitionContext({ analytics }: CompetitionContextProps) {
  if (analytics.length === 0) return null;

  const latest = analytics[0];
  if (latest?.competingListings === undefined) return null;

  return (
    <section className="mb-12">
      <SectionHeading label="Market Context" />

      <div className="bg-card-bg rounded border border-border p-5">
        <div className="mb-4">
          <p className="font-body text-sm font-semibold text-foreground mb-3">Active Comparable Listings</p>
          <p className="font-body text-xs text-muted mb-4">
            Competing listings in your suburb and price bracket during the week ending {latest.weekEnding}
          </p>
        </div>

        <p className="font-mono text-4xl font-medium text-foreground tabular-nums mb-4">{latest.competingListings}</p>

        <div className="text-xs text-muted space-y-1">
          <p>This number helps explain your engagement rates. More competition may mean:</p>
          <ul className="list-disc pl-4 space-y-1 mt-2">
            <li>Buyers have more options to consider</li>
            <li>Marketing spend may need to emphasize what makes your property unique</li>
            <li>Timing and positioning become more critical</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
