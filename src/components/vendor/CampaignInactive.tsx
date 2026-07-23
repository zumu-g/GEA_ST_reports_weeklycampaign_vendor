// Shown at a vendor's URL when their property has left the GEA CRM's live
// listing set (sold, withdrawn, or otherwise no longer active) — U4 of
// docs/plans/2026-07-23-001-fix-portal-live-crm-listings-plan.md. Only
// rendered when the CRM is reachable and confirms the property isn't live;
// on a CRM outage the full report still renders (fail-open).
export default function CampaignInactive({
  address,
  agent,
}: {
  address: string;
  agent: string;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-5xl font-medium text-foreground mb-2">GEA</p>
      <div className="h-0.5 w-12 bg-accent rounded-full mx-auto my-6" />
      <h1 className="font-display text-2xl font-medium text-foreground mb-3">
        This campaign has ended
      </h1>
      <p className="font-body text-sm text-muted max-w-xs leading-relaxed mb-2">
        {address}
      </p>
      <p className="font-body text-sm text-muted max-w-xs leading-relaxed mb-8">
        This listing is no longer active, so live reporting has closed. Reach out to{' '}
        {agent || 'your agent'} for a copy of your final campaign summary.
      </p>
    </div>
  );
}
