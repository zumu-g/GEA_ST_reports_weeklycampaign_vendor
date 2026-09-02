import type { AnalyticsRow } from '@/lib/markdown-loader';
import SectionHeading from '../SectionHeading';

interface CampaignSpendProps {
  analytics: AnalyticsRow[];
}

/**
 * Display campaign spend across REA and Domain for the latest week.
 * Returns null if no spend data.
 */
export default function CampaignSpend({ analytics }: CampaignSpendProps) {
  if (analytics.length === 0) return null;

  const latest = analytics[0];
  const hasSpend = (latest?.reaSpend ?? undefined) !== undefined || (latest?.domainSpend ?? undefined) !== undefined;

  if (!hasSpend) return null;

  const reaSpend = latest.reaSpend ?? 0;
  const domainSpend = latest.domainSpend ?? 0;
  const totalSpend = reaSpend + domainSpend;

  return (
    <section className="mb-12">
      <SectionHeading label="Campaign Spend" meta={<span className="font-body text-xs text-muted">Week ending {latest.weekEnding}</span>} />

      <div className="bg-card-bg rounded border border-border p-5">
        <div className="grid grid-cols-2 gap-4 mb-6">
          {reaSpend > 0 && (
            <div>
              <p className="font-body text-xs text-muted mb-2">realestate.com.au</p>
              <p className="font-mono text-2xl font-medium text-foreground tabular-nums">${reaSpend.toLocaleString()}</p>
            </div>
          )}

          {domainSpend > 0 && (
            <div>
              <p className="font-body text-xs text-muted mb-2">domain.com.au</p>
              <p className="font-mono text-2xl font-medium text-foreground tabular-nums">${domainSpend.toLocaleString()}</p>
            </div>
          )}
        </div>

        {totalSpend > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="font-body text-xs text-muted mb-1">Total Spend (This Week)</p>
            <p className="font-mono text-3xl font-medium text-accent tabular-nums">${totalSpend.toLocaleString()}</p>
          </div>
        )}

        <p className="font-body text-xs text-muted mt-6">
          Premium placements (Featured, Highlighted, Premiere) help your listing stand out to more buyers.
        </p>
      </div>
    </section>
  );
}
