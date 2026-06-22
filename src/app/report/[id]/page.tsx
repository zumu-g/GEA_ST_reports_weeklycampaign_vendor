import { notFound } from "next/navigation";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";
import PortalBreakdown from "@/components/PortalBreakdown";
import Chat from "@/components/Chat";
import ChecklistSection from "@/components/ChecklistSection";
import InspectionHistory from "@/components/InspectionHistory";
import DraftActions from "@/components/DraftActions";
import SectionHeading from "@/components/SectionHeading";
import { getProperty } from "@/lib/markdown-loader";
import { propertyToVendorReport, weeklyDraftToVendorReport } from "@/lib/data-adapter";
import { getWeeklyDraft, parseWeeklyDraftId } from "@/lib/weekly-drafts";
import { fieldDisplay } from "@/lib/field-display";
import type { FieldSource } from "@/lib/types";
import { mockReports } from "@/lib/mock-data";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;

  // Check if id is a weekly draft ID (slug--YYYY-MM-DD)
  const parsedDraft = parseWeeklyDraftId(id);
  const weeklyDraft = parsedDraft
    ? await getWeeklyDraft(parsedDraft.slug, parsedDraft.weekEnding)
    : null;

  let report;
  let property = null;

  if (weeklyDraft) {
    report = weeklyDraftToVendorReport(weeklyDraft);
  } else {
    // Try markdown first (id = slug), then fall back to mock data
    property = await getProperty(id);
    report = property
      ? propertyToVendorReport(property)
      : mockReports.find((r) => r.id === id);
  }

  if (!report) {
    notFound();
  }

  const totalViews = report.reaViews + report.domainViews;
  const totalEnquiries = report.reaEnquiries + report.domainEnquiries;
  const totalSaves = report.reaSaves + report.domainSaves;
  const isDraft = report.status === "draft";

  // Week-over-week trend — analytics[0] is the current week, analytics[1] the prior one.
  // Only markdown-backed properties carry history; mock/draft reports show no pill.
  const prevWeek = property?.analytics?.[1];
  const prevViews = prevWeek ? prevWeek.reaViews + prevWeek.domainViews : null;
  const prevEnquiries = prevWeek ? prevWeek.reaEnquiries + prevWeek.domainEnquiries : null;
  const prevSaves = prevWeek ? prevWeek.reaSaves + prevWeek.domainSaves : null;

  // CRM provenance (draft-backed reports only). A combined total is a gap only
  // when BOTH contributing portal fields are gaps; otherwise it shows the number.
  const fieldSources = weeklyDraft?.fieldSources;
  const combinedSource = (rea: string, domain: string): FieldSource | undefined => {
    if (!fieldSources) return undefined;
    const a = fieldSources[rea];
    const b = fieldSources[domain];
    if (!a && !b) return undefined;
    const gap = (a?.gap ?? true) && (b?.gap ?? true);
    return { source: gap ? null : "crm", capturedAt: null, gap };
  };
  const viewsSource = combinedSource("reaViews", "domainViews");
  const enquiriesSource = combinedSource("reaEnquiries", "domainEnquiries");
  const savesSource = combinedSource("reaSaves", "domainSaves");
  const openHomesDisplay = fieldDisplay(report.openHomeAttendees, fieldSources?.openHomeAttendees);
  const inspectionsDisplay = fieldDisplay(report.privateInspections, fieldSources?.privateInspections);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="reveal max-w-7xl mx-auto px-10 py-10">
        {/* Back link */}
        <Link
          href="/"
          className="text-sm text-muted font-body hover:text-foreground flex items-center gap-1.5 mb-8 transition-colors duration-150"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Property hero card */}
        <div className="bg-primary text-white rounded p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-2">
                {isDraft && (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold font-body uppercase tracking-wider bg-accent/20 text-accent border border-accent/40">
                    Draft · Pending Approval
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl font-medium text-white leading-tight">
                {report.propertyAddress}
              </h1>
              <p className="font-body text-sm text-white/60 mt-3">
                Vendor
              </p>
              <p className="font-body text-sm text-white font-medium mt-0.5">
                {report.vendorName}
              </p>
              <p className="font-body text-xs text-white/50 mt-2">
                {report.agent}
                {report.listingDate && (
                  <>
                    {" "}·{" "}Listed{" "}
                    {new Date(report.listingDate).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-3 flex-shrink-0">
              <p className="font-mono text-2xl font-medium text-accent tabular-nums">
                {report.askingPrice || "Price TBC"}
              </p>
              <span className="rounded-full px-3 py-1 text-xs font-medium font-body bg-white/10 text-white">
                {report.campaignType || "TBC"}
              </span>
              {isDraft && <DraftActions draftId={id} />}
            </div>
          </div>
        </div>

        {/* Latest update banner */}
        {property?.latestUpdate && (
          <div className="bg-accent/10 border border-accent/30 rounded-md px-5 py-4 mb-6">
            <p className="font-body text-sm text-foreground">{property.latestUpdate}</p>
          </div>
        )}

        {/* Week ending heading */}
        {report.weekEnding && (
          <div className="mb-8">
            <SectionHeading
              label={`Week Ending ${new Date(report.weekEnding).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}`}
              meta={<span className="font-body text-xs text-muted">{report.daysOnMarket} days on market</span>}
            />
          </div>
        )}

        {/* Online reach — Views is the headline figure; enquiries and saves support it.
            Inspection counts live in the Inspections Summary below, not duplicated here. */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-10">
          <div className="md:col-span-6">
            <StatCard
              label="Total Views"
              value={totalViews}
              variant="hero"
              subtitle="Across realestate.com.au and domain.com.au"
              previousValue={prevViews}
              fieldSource={viewsSource}
            />
          </div>
          <div className="md:col-span-3">
            <StatCard label="Enquiries" value={totalEnquiries} subtitle="Buyer enquiries" previousValue={prevEnquiries} fieldSource={enquiriesSource} />
          </div>
          <div className="md:col-span-3">
            <StatCard label="Saves" value={totalSaves} subtitle="Added to watchlists" previousValue={prevSaves} fieldSource={savesSource} />
          </div>
        </div>

        {/* Portal breakdown */}
        {(report.reaViews > 0 || report.domainViews > 0) && (
          <div className="mb-8">
            <SectionHeading label="Portal Breakdown" />
            <PortalBreakdown report={report} />
          </div>
        )}

        {/* Campaign checklist — markdown properties only */}
        {property && property.checklist.length > 0 && (
          <ChecklistSection checklist={property.checklist} />
        )}

        {/* Inspection history — markdown properties only */}
        {property && property.inspections.length > 0 && (
          <InspectionHistory inspections={property.inspections} />
        )}

        {/* Inspections summary card */}
        <div className="mb-8">
          <SectionHeading label="Inspections Summary" />
          <div className="bg-card-bg rounded border border-border p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="pb-6 md:pb-0 md:pr-8">
                {openHomesDisplay.isGap ? (
                  <p className="font-body italic text-muted/60 text-lg leading-none">Needs entry</p>
                ) : (
                  <p className="font-mono text-3xl font-medium text-foreground tabular-nums">
                    {report.openHomeAttendees}
                  </p>
                )}
                <p className="font-body text-sm text-muted mt-1">
                  Open Home Attendees
                </p>
                <p className="font-body text-xs text-muted/70 mt-1 leading-snug">
                  Groups through the property at scheduled open homes
                </p>
              </div>
              <div className="py-6 md:py-0 md:px-8">
                {inspectionsDisplay.isGap ? (
                  <p className="font-body italic text-muted/60 text-lg leading-none">Needs entry</p>
                ) : (
                  <p className="font-mono text-3xl font-medium text-foreground tabular-nums">
                    {report.privateInspections}
                  </p>
                )}
                <p className="font-body text-sm text-muted mt-1">
                  Private Inspections
                </p>
                <p className="font-body text-xs text-muted/70 mt-1 leading-snug">
                  By-appointment inspections with qualified buyers
                </p>
              </div>
              <div className="pt-6 md:pt-0 md:pl-8">
                <p className="font-mono text-3xl font-medium text-foreground tabular-nums">
                  {report.openHomeAttendees + report.privateInspections}
                </p>
                <p className="font-body text-sm text-muted mt-1">
                  Total Inspections
                </p>
                <p className="font-body text-xs text-muted/70 mt-1 leading-snug">
                  Combined open home and private viewings
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-16 py-6 text-center font-body text-sm text-muted">
        Grants Estate Agents · Weekly Campaign &amp; Vendor Reports
      </footer>

      {/* Chat widget */}
      <Chat messages={report.messages} vendorName={report.vendorName} />
    </div>
  );
}
