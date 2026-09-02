import type { AnalyticsRow } from '@/lib/markdown-loader';
import SectionHeading from '../SectionHeading';

interface ActivityFunnelProps {
  analytics: AnalyticsRow[];
}

/**
 * Render a funnel view: Impressions → Views → Detail Views → Enquiries.
 * Derived from stored counts; a gap step collapses rather than showing zero.
 * Returns null if no extended metrics exist.
 */
export default function ActivityFunnel({ analytics }: ActivityFunnelProps) {
  if (analytics.length === 0) return null;

  const latest = analytics[0];
  if (!latest) return null;

  // Collect all steps that have data (defined and not a gap).
  // Build funnel in order: Impressions → Views → Detail Views → Enquiries.
  // If extended metrics (Impressions, Detail Views) are missing, show just the core funnel.
  const steps = [
    {
      label: 'Impressions',
      rea: latest.reaImpressions,
      domain: latest.domainImpressions,
    },
    {
      label: 'Views',
      rea: latest.reaViews,
      domain: latest.domainViews,
    },
    {
      label: 'Detail Views',
      rea: latest.reaDetailViews,
      domain: latest.domainDetailViews,
    },
    {
      label: 'Enquiries',
      rea: latest.reaEnquiries,
      domain: latest.domainEnquiries,
    },
  ].filter(s => s.rea !== undefined || s.domain !== undefined);

  // If only the core funnel (Views/Enquiries) is present, no extended data
  if (!latest.reaImpressions && !latest.domainImpressions && !latest.reaDetailViews && !latest.domainDetailViews) {
    return null;
  }

  if (steps.length === 0) return null;

  return (
    <section className="mb-12">
      <SectionHeading label="Activity Funnel" meta={<span className="font-body text-xs text-muted">Week ending {latest.weekEnding}</span>} />

      <div className="space-y-4">
        {steps.map((step, idx) => {
          const reaMerged = (step.rea ?? 0) + (step.domain ?? 0); // Total for this step
          const nextStep = idx + 1 < steps.length ? steps[idx + 1] : null;
          const nextTotal = nextStep ? (nextStep.rea ?? 0) + (nextStep.domain ?? 0) : 0;

          // Conversion rate to the next step
          const conversionPct = reaMerged > 0 && nextTotal > 0 ? Math.round((nextTotal / reaMerged) * 100) : 0;

          return (
            <div key={step.label} className="bg-card-bg rounded border border-border p-5">
              <div className="flex items-end justify-between mb-3">
                <p className="font-body text-sm font-semibold text-foreground">{step.label}</p>
                {idx < steps.length - 1 && conversionPct > 0 && (
                  <p className="font-body text-xs text-muted">{conversionPct}% to next step</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {step.rea !== undefined && (
                  <div>
                    <p className="font-body text-xs text-muted mb-1">REA</p>
                    <p className="font-mono text-lg font-medium text-foreground tabular-nums">{step.rea.toLocaleString()}</p>
                  </div>
                )}
                {step.domain !== undefined && (
                  <div>
                    <p className="font-body text-xs text-muted mb-1">Domain</p>
                    <p className="font-mono text-lg font-medium text-foreground tabular-nums">{step.domain.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
