import { notFound } from 'next/navigation';
import { getPropertySlugForToken } from '@/lib/vendor-tokens';
import { getProperty } from '@/lib/markdown-loader';
import VendorHeader from '@/components/vendor/VendorHeader';
import CampaignChecklist from '@/components/vendor/CampaignChecklist';
import AppointmentCalendar from '@/components/vendor/AppointmentCalendar';
import UpcomingOpens from '@/components/vendor/UpcomingOpens';
import CampaignTimeline from '@/components/vendor/CampaignTimeline';
import CommunicationsLog from '@/components/vendor/CommunicationsLog';
import ActivityFeed from '@/components/vendor/ActivityFeed';
import ActivityTicker from '@/components/vendor/ActivityTicker';
import LiveStatsTile from '@/components/vendor/LiveStatsTile';
import CommentThread from '@/components/vendor/CommentThread';
import DocumentHub from '@/components/vendor/DocumentHub';
import GuidesSpotlight from '@/components/vendor/GuidesSpotlight';
import MarketNews from '@/components/vendor/MarketNews';
import LocalMarket from '@/components/vendor/LocalMarket';
import DownloadButton from '@/components/vendor/DownloadButton';
import InspectionHistory from '@/components/InspectionHistory';
import SectionHeading from '@/components/SectionHeading';
import DailyQuote from '@/components/vendor/DailyQuote';
import TrendBadge from '@/components/vendor/TrendBadge';
import WeeklyTrend from '@/components/vendor/WeeklyTrend';
import { getDailyQuote } from '@/lib/quotes';

function calcDaysOnMarket(listed: string, weekEnding?: string): number {
  if (!listed) return 0;
  const parsed = new Date(listed);
  if (isNaN(parsed.getTime())) return 0;
  const ref = weekEnding ? new Date(weekEnding) : new Date();
  const refMs = isNaN(ref.getTime()) ? Date.now() : ref.getTime();
  return Math.max(0, Math.floor((refMs - parsed.getTime()) / 86_400_000));
}

function sumAnalytics(analytics: { reaViews: number; reaEnquiries: number; reaSaves: number; domainViews: number; domainEnquiries: number; domainSaves: number }[]) {
  return analytics.reduce(
    (acc, row) => ({
      reaViews: acc.reaViews + row.reaViews,
      reaEnquiries: acc.reaEnquiries + row.reaEnquiries,
      reaSaves: acc.reaSaves + row.reaSaves,
      domainViews: acc.domainViews + row.domainViews,
      domainEnquiries: acc.domainEnquiries + row.domainEnquiries,
      domainSaves: acc.domainSaves + row.domainSaves,
    }),
    { reaViews: 0, reaEnquiries: 0, reaSaves: 0, domainViews: 0, domainEnquiries: 0, domainSaves: 0 }
  );
}

export default async function VendorDashboard({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const slug = getPropertySlugForToken(token);
  if (!slug) notFound();

  const property = await getProperty(slug);
  if (!property) notFound();

  const totals = sumAnalytics(property.analytics);
  const latestAnalytics = property.analytics[0] ?? null;
  const daysOnMarket = calcDaysOnMarket(property.listed, latestAnalytics?.weekEnding);
  const previousAnalytics = property.analytics[1] ?? null;

  const reportDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const dailyQuote = getDailyQuote();

  // Masthead: split "85 Centenary Boulevard, Officer South VIC 3809" into a big
  // street headline and a quieter locality line.
  const [heroStreet, ...heroRest] = property.address.split(',');
  const heroLocality = heroRest.join(',').trim();

  // Suburb label for the local-market sections; the vendor-report endpoint
  // geocodes the address itself, so no client-side geocode is needed here.
  const localitySuburb = property.address.includes(',')
    ? property.address.split(',').slice(-1)[0].replace(/\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\b/i, '').replace(/\d{4}/, '').trim()
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <VendorHeader address={property.address} daysOnMarket={daysOnMarket} token={token} />
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-4 print:hidden">
        <ActivityTicker slug={property.slug} />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block px-5 pt-6 pb-6 border-b border-border max-w-2xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <p className="font-display text-lg font-medium text-foreground">Grant Estate Agency</p>
          <p className="font-body text-xs text-muted">{reportDate}</p>
        </div>
        <p className="font-display text-2xl font-medium text-foreground leading-tight mb-1">{property.address}</p>
        {property.owner && (
          <p className="font-body text-xs text-muted mb-3">For {property.owner} · Private &amp; Confidential</p>
        )}
        <div className="flex gap-8 mt-3 pt-3 border-t border-border">
          <div>
            <p className="font-body text-[10px] text-muted uppercase tracking-widest mb-0.5">Price Guide</p>
            <p className="font-body text-sm font-medium text-foreground">{property.priceGuide || 'TBC'}</p>
          </div>
          <div>
            <p className="font-body text-[10px] text-muted uppercase tracking-widest mb-0.5">Agent</p>
            <p className="font-body text-sm font-medium text-foreground">{property.agent || 'Stuart Grant'}</p>
          </div>
          <div>
            <p className="font-body text-[10px] text-muted uppercase tracking-widest mb-0.5">Campaign</p>
            <p className="font-body text-sm font-medium text-foreground">{property.campaignType}</p>
          </div>
          <div>
            <p className="font-body text-[10px] text-muted uppercase tracking-widest mb-0.5">Listed</p>
            <p className="font-body text-sm font-medium text-foreground">{property.listed}</p>
          </div>
        </div>
      </div>

      <main className="reveal max-w-2xl mx-auto px-5 pt-10 pb-16">

        {/* ── Hero / masthead (web only; print uses the print header above) ── */}
        <section className="mb-12 print:hidden">
          <div className="flex items-start justify-between gap-4">
            <p className="eyebrow pt-2">{property.campaignType || 'Campaign'}</p>
            <div className="flex-shrink-0">
              <DownloadButton />
            </div>
          </div>
          <h1
            className="font-display font-medium text-foreground tracking-[-0.015em] mt-3"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 4.25rem)', lineHeight: 1.02 }}
          >
            {heroStreet}
          </h1>
          {heroLocality && (
            <p className="font-body text-base sm:text-lg text-muted mt-2">{heroLocality}</p>
          )}
          {/* Signature short gold hairline */}
          <div className="h-px w-14 bg-accent mt-6" aria-hidden="true" />
          {property.owner && (
            <p className="font-body text-xs text-muted mt-6">
              For {property.owner} · Private &amp; Confidential · Listed {property.listed}
            </p>
          )}

          {/* Key facts row — price takes a full-width row on narrow phones, all three inline from ~420px */}
          <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-x-4 gap-y-5 pt-6 border-t border-border">
            <div className="col-span-2 min-[420px]:col-span-1">
              <p className="eyebrow mb-1">Price Guide</p>
              <p className="font-mono text-xl font-medium text-foreground tabular-nums">{property.priceGuide || 'TBC'}</p>
            </div>
            <div>
              <p className="eyebrow mb-1">Agent</p>
              <p className="font-body text-sm font-medium text-foreground">{property.agent || 'Stuart Grant'}</p>
            </div>
            <div>
              <p className="eyebrow mb-1">Days on market</p>
              <p className="font-mono text-sm font-medium text-foreground tabular-nums">{daysOnMarket > 0 ? daysOnMarket : '-'}</p>
            </div>
          </div>
        </section>

        {/* ── Recent Activity (live; web only) ─────────────── */}
        <div className="print:hidden">
          <LiveStatsTile slug={property.slug} listed={property.listed} />

          <ActivityFeed slug={property.slug} />
        </div>

        {/* ── Latest Update ────────────────────────────────── */}
        {property.latestUpdate && (
          <section className="mb-10" data-tour="latest-update">
            <div className="bg-accent/12 rounded-lg px-5 py-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-body text-[10px] text-accent font-semibold uppercase tracking-widest">Update from Your Agent</p>
                <p className="font-body text-[10px] text-muted">{reportDate}</p>
              </div>
              <p className="font-body text-base text-foreground leading-relaxed max-w-[65ch]">{property.latestUpdate}</p>
              <p className="font-body text-xs text-muted mt-3">{property.agent || 'Stuart Grant'}</p>
            </div>
          </section>
        )}

        {/* ── Inspection History ───────────────────────────── */}
        {property.inspections.length > 0 && (
          <InspectionHistory inspections={property.inspections} />
        )}

        {property.inspections.length === 0 && (
          <section className="mb-10">
            <SectionHeading label="Inspections" count={0} />
            <div className="bg-card-bg rounded border border-border px-6 py-10 text-center">
              <p className="font-body text-sm text-foreground mb-1">No inspections scheduled yet.</p>
              <p className="font-body text-xs text-muted">Your agent will update this as inspections are confirmed.</p>
            </div>
          </section>
        )}

        {/* ── Upcoming Opens + Appointments (live; web only) ── */}
        <div className="print:hidden">
          <UpcomingOpens slug={property.slug} />

          <div data-tour="appointments">
            <AppointmentCalendar calendarId={property.calendarId} />
          </div>
        </div>

        {/* ── Campaign Analytics ───────────────────────────── */}
        {property.analytics.length > 0 && (
          <section className="mb-12" data-tour="analytics">
            <SectionHeading
              label="Online Reach"
              meta={latestAnalytics ? <span className="font-body text-xs text-muted">Week ending {latestAnalytics.weekEnding}</span> : undefined}
            />

            {/* Campaign totals */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-8 pb-8 border-b border-border">
              <div>
                <div className="flex items-baseline gap-0">
                  <p className="font-mono text-3xl sm:text-4xl font-medium text-foreground tabular-nums leading-none">
                    {(totals.reaViews + totals.domainViews).toLocaleString()}
                  </p>
                  {latestAnalytics && previousAnalytics && (
                    <TrendBadge
                      current={latestAnalytics.reaViews + latestAnalytics.domainViews}
                      previous={previousAnalytics.reaViews + previousAnalytics.domainViews}
                    />
                  )}
                </div>
                <p className="font-body text-xs text-muted mt-2">People who viewed your listing</p>
                <p className="font-body text-[10px] text-muted/60 mt-0.5 hidden sm:block">realestate.com.au + domain.com.au</p>
              </div>
              <div>
                <div className="flex items-baseline gap-0">
                  <p className="font-mono text-2xl font-medium text-foreground tabular-nums leading-none">
                    {(totals.reaEnquiries + totals.domainEnquiries).toLocaleString()}
                  </p>
                  {latestAnalytics && previousAnalytics && (
                    <TrendBadge
                      current={latestAnalytics.reaEnquiries + latestAnalytics.domainEnquiries}
                      previous={previousAnalytics.reaEnquiries + previousAnalytics.domainEnquiries}
                    />
                  )}
                </div>
                <p className="font-body text-xs text-muted mt-2">Buyer enquiries</p>
              </div>
              <div>
                <div className="flex items-baseline gap-0">
                  <p className="font-mono text-2xl font-medium text-foreground tabular-nums leading-none">
                    {(totals.reaSaves + totals.domainSaves).toLocaleString()}
                  </p>
                  {latestAnalytics && previousAnalytics && (
                    <TrendBadge
                      current={latestAnalytics.reaSaves + latestAnalytics.domainSaves}
                      previous={previousAnalytics.reaSaves + previousAnalytics.domainSaves}
                    />
                  )}
                </div>
                <p className="font-body text-xs text-muted mt-2">Added to watchlists</p>
              </div>
            </div>

            {/* Per-portal breakdown — no nested stat boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  name: 'realestate.com.au',
                  color: 'bg-red-500',
                  stats: [
                    {
                      label: 'Views',
                      value: totals.reaViews,
                      current: latestAnalytics?.reaViews,
                      previous: previousAnalytics?.reaViews,
                    },
                    {
                      label: 'Enquiries',
                      value: totals.reaEnquiries,
                      current: latestAnalytics?.reaEnquiries,
                      previous: previousAnalytics?.reaEnquiries,
                    },
                    {
                      label: 'Watchlisted',
                      value: totals.reaSaves,
                      current: latestAnalytics?.reaSaves,
                      previous: previousAnalytics?.reaSaves,
                    },
                  ],
                },
                {
                  name: 'domain.com.au',
                  color: 'bg-emerald-500',
                  stats: [
                    {
                      label: 'Views',
                      value: totals.domainViews,
                      current: latestAnalytics?.domainViews,
                      previous: previousAnalytics?.domainViews,
                    },
                    {
                      label: 'Enquiries',
                      value: totals.domainEnquiries,
                      current: latestAnalytics?.domainEnquiries,
                      previous: previousAnalytics?.domainEnquiries,
                    },
                    {
                      label: 'Watchlisted',
                      value: totals.domainSaves,
                      current: latestAnalytics?.domainSaves,
                      previous: previousAnalytics?.domainSaves,
                    },
                  ],
                },
              ].map(portal => (
                <div key={portal.name} className="bg-card-bg rounded border border-border overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <span className={`w-2 h-2 rounded-full ${portal.color} flex-shrink-0`} />
                      <span className="font-body text-sm font-semibold text-foreground">{portal.name}</span>
                    </div>
                    <div className="space-y-0">
                      {portal.stats.map((s, i) => (
                        <div
                          key={s.label}
                          className={`flex items-baseline justify-between py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                        >
                          <p className="font-body text-sm text-muted">{s.label}</p>
                          <div className="flex items-baseline">
                            <p className="font-mono text-lg font-medium tabular-nums text-foreground">{s.value.toLocaleString()}</p>
                            {s.current !== undefined && (
                              <TrendBadge current={s.current} previous={s.previous} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Weekly Trend ─────────────────────────────────── */}
        <WeeklyTrend analytics={property.analytics} />

        {/* ── What's Next (live; web only) ─────────────────── */}
        <div className="print:hidden">
          <CampaignTimeline slug={property.slug} />

          {/* ── Campaign Checklist (interactive; web only) ──── */}
          {property.checklist.length > 0 && (
            <div data-tour="checklist">
              <CampaignChecklist items={property.checklist} storageKey={`gea:checklist:${property.slug}`} />
            </div>
          )}
        </div>

        {/* ── Communications ───────────────────────────────── */}
        <CommunicationsLog communications={property.communications} />

        {/* ── Market News ──────────────────────────────────── */}
        <MarketNews news={property.news} />

        {/* ── Live / interactive sections (web only) ───────── */}
        <div className="print:hidden">
          {/* Documents */}
          <DocumentHub token={token} />

          {/* Two-way Messages */}
          <CommentThread token={token} />

          {/* Local Market (just sold + just listed within 500m) */}
          <LocalMarket address={property.address} suburb={localitySuburb} />

          {/* Seller Guides */}
          <GuidesSpotlight token={token} />

          {/* Daily Quote */}
          <DailyQuote text={dailyQuote.text} author={dailyQuote.author} />
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <footer className="mt-12 pt-8 pb-4 text-center border-t border-border">
          <p className="font-body text-xs text-muted">
            Grant Estate Agency · Private &amp; Confidential
          </p>
        </footer>

      </main>
    </div>
  );
}
