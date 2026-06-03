import Link from "next/link";
import Header from "@/components/Header";
import PropertyCard from "@/components/PropertyCard";
import RentalCard from "@/components/RentalCard";
import WeeklyWorkflow from "@/components/WeeklyWorkflow";
import { getAllProperties } from "@/lib/markdown-loader";
import { propertyToVendorReport } from "@/lib/data-adapter";
import { getAllWeeklyDrafts, getComingWeekEnding } from "@/lib/weekly-drafts";
import { mockReports } from "@/lib/mock-data";
import { getTokenForSlug } from "@/lib/vendor-tokens";
import { getAllRentals } from "@/lib/rental-loader";
import { getRentalTokenForSlug } from "@/lib/rental-tokens";
import { WeeklyDraft } from "@/lib/types";
import SectionHeading from "@/components/SectionHeading";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // Load properties from markdown files
  const properties = await getAllProperties();
  const markdownReports = properties.map(propertyToVendorReport);

  // Combine: markdown properties first, then mock data as fallback demo
  const reports = markdownReports.length > 0 ? markdownReports : mockReports;

  // Load this week's drafts and map by property slug
  const currentWeekEnding = getComingWeekEnding();
  const weeklyDrafts = await getAllWeeklyDrafts(currentWeekEnding);
  const draftMap = new Map<string, WeeklyDraft>(weeklyDrafts.map((d) => [d.propertySlug, d]));

  const pendingCount = weeklyDrafts.filter((d) => d.status === "draft").length;

  const totalReaViews = reports.reduce((sum, r) => sum + r.reaViews, 0);
  const totalDomainViews = reports.reduce((sum, r) => sum + r.domainViews, 0);
  const totalEnquiries = reports.reduce(
    (sum, r) => sum + r.reaEnquiries + r.domainEnquiries,
    0
  );
  const rentals = await getAllRentals();

  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const usingMockData = markdownReports.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {usingMockData && (
        <div className="bg-warning/10 border-b border-warning/20">
          <div className="max-w-7xl mx-auto px-10 py-2.5 flex items-center gap-3">
            <span className="font-body text-sm font-medium text-warning">Demo data</span>
            <span className="w-px h-3.5 bg-warning/30" />
            <span className="font-body text-xs text-warning/80">No property files found in GEA_vendor_portal/properties/. Check that the folder is accessible and contains markdown files.</span>
          </div>
        </div>
      )}

      <main className="reveal max-w-7xl mx-auto px-10 py-12">

        {/* Week heading + at-a-glance summary */}
        <div className="mb-6">
          <h1 className="font-display text-3xl font-normal leading-tight tracking-tight text-foreground">
            Campaign Dashboard
          </h1>
          {/* Metric strip: hairline dividers, not repeated middle-dots (rationed to 1/line) */}
          <div className="font-body text-sm text-muted mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 [&>span:not(:first-child)]:border-l [&>span:not(:first-child)]:border-border [&>span:not(:first-child)]:pl-4">
            <span>{today}</span>
            <span className="tabular-nums">{reports.length} listing{reports.length !== 1 ? "s" : ""}</span>
            <span className="tabular-nums">{(totalReaViews + totalDomainViews).toLocaleString()} views</span>
            <span className="tabular-nums">{totalEnquiries} enquir{totalEnquiries !== 1 ? "ies" : "y"}</span>
            {pendingCount > 0 && (
              <span className="tabular-nums text-accent font-medium">{pendingCount} pending</span>
            )}
          </div>
        </div>

        {/* Vendor Reports heading + draft controls */}
        <div className="mt-16">
          <SectionHeading
            label="Vendor Reports"
            meta={<WeeklyWorkflow weekEnding={currentWeekEnding} />}
          />
          <p className="font-body text-sm text-muted -mt-3 mb-6">
            {pendingCount > 0 ? (
              <span className="text-accent font-medium">
                {pendingCount} report{pendingCount !== 1 ? "s" : ""} pending approval
              </span>
            ) : (
              "Select a property to view the full campaign report"
            )}
          </p>
        </div>

        {/* Property grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {reports.map((report) => (
            <PropertyCard
              key={report.id}
              report={report}
              draft={draftMap.get(report.id) ?? null}
              vendorToken={getTokenForSlug(report.id)}
            />
          ))}
        </div>

        {/* Rental Reports section */}
        <div className="mt-20">
          <SectionHeading
            label="Rental Reports"
            meta={
              <Link
                href="/generate/rental"
                className="rounded px-4 py-2 text-sm font-medium font-body text-muted border border-border hover:border-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                New Rental Report
              </Link>
            }
          />
          <p className="font-body text-sm text-muted -mt-3 mb-6">
            {rentals.length > 0
              ? `${rentals.length} active rental listing${rentals.length !== 1 ? 's' : ''}`
              : 'No rental listings yet'}
          </p>
        </div>

        {rentals.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {rentals.map(rental => (
              <RentalCard
                key={rental.slug}
                rental={rental}
                token={getRentalTokenForSlug(rental.slug)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-card-bg rounded border border-border px-6 py-12 text-center">
            <p className="font-body text-sm text-muted mb-3">No rental listings yet.</p>
            <Link
              href="/generate/rental"
              className="font-body text-sm text-accent hover:underline"
            >
              Create the first rental report →
            </Link>
          </div>
        )}
      </main>

      <footer className="mt-20 bg-surface border-t border-border py-8 text-center font-body">
        <p className="font-body text-xs text-muted uppercase tracking-widest leading-none">Grants Estate Agents</p>
        <p className="font-body text-xs text-muted/50 mt-1.5 leading-none">Weekly Campaign &amp; Vendor Reports</p>
      </footer>
    </div>
  );
}
