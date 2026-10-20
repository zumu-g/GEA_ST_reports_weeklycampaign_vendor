import type { AnalyticsRow } from '@/lib/markdown-loader';
import type { CompetitorListing } from '@/lib/competitors';
import SectionHeading from '../SectionHeading';

interface CompetitionContextProps {
  analytics: AnalyticsRow[];
  competitors?: CompetitorListing[];
}

function askingLabel(c: CompetitorListing): string {
  if (c.askingLow != null && c.askingHigh != null && c.askingLow !== c.askingHigh) {
    return `$${c.askingLow.toLocaleString('en-AU')}–$${c.askingHigh.toLocaleString('en-AU')}`;
  }
  const single = c.askingHigh ?? c.askingLow;
  return single != null ? `$${single.toLocaleString('en-AU')}` : '—';
}

/**
 * Display competing listings count/table and context for the latest week.
 * Returns null if neither the weekly count nor a competitor snapshot exists.
 */
export default function CompetitionContext({ analytics, competitors }: CompetitionContextProps) {
  const latest = analytics[0];
  const count = latest?.competingListings ?? competitors?.length;
  if (count === undefined && (!competitors || competitors.length === 0)) return null;

  return (
    <section className="mb-12">
      <SectionHeading label="Market Context" />

      <div className="bg-card-bg rounded border border-border p-5">
        <div className="mb-4">
          <p className="font-body text-sm font-semibold text-foreground mb-3">Active Comparable Listings</p>
          <p className="font-body text-xs text-muted mb-4">
            Competing listings in your suburb and price bracket{latest ? ` during the week ending ${latest.weekEnding}` : ''}
          </p>
        </div>

        {count !== undefined && (
          <p className="font-mono text-4xl font-medium text-foreground tabular-nums mb-4">{count}</p>
        )}

        {competitors && competitors.length > 0 && (
          <ul className="divide-y divide-border border-t border-border mb-4">
            {competitors.map((c, i) => (
              <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                <span className="font-body text-sm text-foreground truncate">{c.address}</span>
                <span className="font-mono text-xs text-muted tabular-nums flex-shrink-0">{askingLabel(c)}</span>
              </li>
            ))}
          </ul>
        )}

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
