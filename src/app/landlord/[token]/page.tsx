import { notFound } from 'next/navigation';
import { getRentalSlugForToken } from '@/lib/rental-tokens';
import { getRental } from '@/lib/rental-loader';
import VendorHeader from '@/components/vendor/VendorHeader';
import CampaignChecklist from '@/components/vendor/CampaignChecklist';
import CampaignTimeline from '@/components/vendor/CampaignTimeline';
import CommunicationsLog from '@/components/vendor/CommunicationsLog';
import MarketNews from '@/components/vendor/MarketNews';
import DownloadButton from '@/components/vendor/DownloadButton';
import InspectionHistory from '@/components/InspectionHistory';
import SectionHeading from '@/components/SectionHeading';
import StatCard from '@/components/StatCard';
import type { RentalAnalyticsRow } from '@/lib/types';

function calcDaysListed(listed: string, weekEnding?: string): number {
  if (!listed) return 0;
  const parsed = new Date(listed);
  if (isNaN(parsed.getTime())) return 0;
  const ref = weekEnding ? new Date(weekEnding) : new Date();
  const refMs = isNaN(ref.getTime()) ? Date.now() : ref.getTime();
  return Math.max(0, Math.floor((refMs - parsed.getTime()) / 86_400_000));
}

function sumAnalytics(analytics: RentalAnalyticsRow[]) {
  return analytics.reduce(
    (acc, row) => ({
      reaViews: acc.reaViews + row.reaViews,
      reaEnquiries: acc.reaEnquiries + row.reaEnquiries,
      reaSaves: acc.reaSaves + row.reaSaves,
      domainViews: acc.domainViews + row.domainViews,
      domainEnquiries: acc.domainEnquiries + row.domainEnquiries,
      domainSaves: acc.domainSaves + row.domainSaves,
      applications: acc.applications + row.applications,
    }),
    { reaViews: 0, reaEnquiries: 0, reaSaves: 0, domainViews: 0, domainEnquiries: 0, domainSaves: 0, applications: 0 }
  );
}

export default async function LandlordDashboard({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const slug = getRentalSlugForToken(token);
  if (!slug) notFound();

  const property = await getRental(slug);
  if (!property) notFound();

  const totals = sumAnalytics(property.analytics);
  const latestAnalytics = property.analytics[0] ?? null;
  const daysListed = calcDaysListed(property.listed, latestAnalytics?.weekEnding);
  const reportDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <VendorHeader address={property.address} daysOnMarket={daysListed} />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block px-5 pt-6 pb-4 border-b border-border max-w-2xl mx-auto">
        <p className="font-display text-lg font-medium text-foreground">Grant Estate Agents</p>
        <p className="font-body text-xs text-muted mt-0.5">Weekly Rental Report · {reportDate}</p>
      </div>

      <main className="reveal max-w-2xl mx-auto px-5 py-8">

        {/* Hero */}
        <section className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h1 className="font-display text-2xl font-medium text-foreground leading-tight">
              {property.address}
            </h1>
            <DownloadButton />
          </div>
          <p className="font-body text-sm text-muted mb-4">
            {property.leaseType} · Listed {property.listed}
          </p>

          <div className="bg-card-bg rounded border border-border p-5 flex flex-wrap gap-5">
            <div>
              <p className="eyebrow mb-1">Weekly Rent</p>
              <p className="font-mono text-lg font-medium text-foreground tabular-nums">{property.rentPw || 'TBC'}</p>
            </div>
            <div className="w-px bg-border self-stretch" />
            <div>
              <p className="font-body text-xs text-muted mb-0.5">Agent</p>
              <p className="font-body text-sm font-medium text-foreground">{property.agent || 'Stuart Grant'}</p>
            </div>
            <div className="w-px bg-border self-stretch" />
            <div>
              <p className="font-body text-xs text-muted mb-0.5">Lease Type</p>
              <p className="font-body text-sm font-medium text-foreground">{property.leaseType || 'Private Rental'}</p>
            </div>
          </div>
        </section>

        {/* Latest Update */}
        {property.latestUpdate && (
          <section className="mb-8">
            <div className="bg-accent/10 border border-border rounded-md px-5 py-4">
              <p className="eyebrow mb-1.5">Latest Update</p>
              <p className="font-body text-sm text-foreground leading-relaxed">{property.latestUpdate}</p>
            </div>
          </section>
        )}

        {/* Campaign Checklist (interactive) + What's Next (live) — web only */}
        <div className="print:hidden">
          {property.checklist.length > 0 && (
            <CampaignChecklist items={property.checklist} storageKey={`gea:checklist:${property.slug}`} />
          )}

          {/* What's Next — ClickUp tasks tagged vendor */}
          <CampaignTimeline slug={property.slug} />
        </div>

        {/* Analytics */}
        {property.analytics.length > 0 && (
          <section className="mb-8">
            <SectionHeading
              label="Listing Analytics"
              meta={latestAnalytics ? <span className="font-body text-xs text-muted">w/e {latestAnalytics.weekEnding}</span> : undefined}
            />

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <StatCard
                label="Total Views"
                value={totals.reaViews + totals.domainViews}
                subtitle="REA + Domain"
              />
              <StatCard
                label="Enquiries"
                value={totals.reaEnquiries + totals.domainEnquiries}
              />
              <StatCard
                label="Applications"
                value={totals.applications}
              />
            </div>

            {/* Per-portal breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card-bg rounded border border-border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="font-body text-sm font-semibold text-foreground">realestate.com.au</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Views', value: totals.reaViews },
                      { label: 'Enquiries', value: totals.reaEnquiries },
                      { label: 'Saves', value: totals.reaSaves },
                    ].map(s => (
                      <div key={s.label} className="bg-background rounded-md p-3">
                        <p className="font-mono text-xl font-medium tabular-nums text-foreground">{s.value.toLocaleString()}</p>
                        <p className="font-body text-xs text-muted mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-card-bg rounded border border-border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="font-body text-sm font-semibold text-foreground">domain.com.au</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Views', value: totals.domainViews },
                      { label: 'Enquiries', value: totals.domainEnquiries },
                      { label: 'Saves', value: totals.domainSaves },
                    ].map(s => (
                      <div key={s.label} className="bg-background rounded-md p-3">
                        <p className="font-mono text-xl font-medium tabular-nums text-foreground">{s.value.toLocaleString()}</p>
                        <p className="font-body text-xs text-muted mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Market News */}
        <MarketNews news={property.news} />

        {/* Inspection History */}
        {property.inspections.length > 0 && (
          <InspectionHistory inspections={property.inspections} />
        )}

        {property.inspections.length === 0 && (
          <section className="mb-8">
            <SectionHeading label="Inspections" count={0} />
            <div className="bg-card-bg rounded border border-border px-6 py-8 text-center">
              <p className="font-body text-sm text-muted">No inspections logged yet.</p>
            </div>
          </section>
        )}

        {/* Communications Log */}
        <CommunicationsLog communications={property.communications} />

        {/* Footer */}
        <footer className="pt-4 pb-8 text-center border-t border-border mt-4">
          <p className="font-body text-xs text-muted">
            Grant Estate Agency · For {property.landlord || 'the landlord'} · Private & Confidential
          </p>
        </footer>
      </main>
    </div>
  );
}
