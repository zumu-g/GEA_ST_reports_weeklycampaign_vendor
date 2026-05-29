import Link from "next/link";
import { VendorReport, WeeklyDraft } from "@/lib/types";
import ShareButton from "@/components/ShareButton";
import ApproveDraftButton from "@/components/ApproveDraftButton";

interface PropertyCardProps {
  report: VendorReport;
  draft?: WeeklyDraft | null;
  vendorToken?: string | null;
}

export default function PropertyCard({ report, draft, vendorToken }: PropertyCardProps) {
  const totalViews = report.reaViews + report.domainViews;
  const totalEnquiries = report.reaEnquiries + report.domainEnquiries;
  const linkId = draft ? draft.id : report.id;
  const isDraft = draft?.status === "draft";

  return (
    <div className="bg-card-bg rounded border border-border p-6 hover:border-muted/40 hover:bg-surface/40 transition-colors duration-200">

      {/* Top section: address + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-normal leading-snug tracking-tight text-foreground">
            {report.propertyAddress}
          </h3>
          <p className="font-body text-sm text-muted mt-1">{report.vendorName}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDraft && (
            <span className="rounded px-2.5 py-0.5 text-xs font-medium font-body uppercase tracking-widest bg-accent/15 text-accent border border-accent/30">
              Draft
            </span>
          )}
          <span className="rounded px-3 py-1 text-xs font-medium font-body bg-surface text-foreground border border-border whitespace-nowrap">
            {report.campaignType}
          </span>
        </div>
      </div>

      {/* Asking price */}
      <p className="font-mono text-2xl font-medium text-foreground mt-3 tabular-nums leading-none">
        {report.askingPrice}
      </p>

      <div className="border-t border-border my-4" />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <p className="font-mono font-medium text-foreground text-sm tabular-nums">
            {totalViews.toLocaleString()}
          </p>
          <p className="font-body text-xs text-muted mt-0.5">Total Views</p>
        </div>
        <div>
          <p className="font-mono font-medium text-foreground text-sm tabular-nums">
            {totalEnquiries}
          </p>
          <p className="font-body text-xs text-muted mt-0.5">Enquiries</p>
        </div>
        <div>
          <p className="font-mono font-medium text-foreground text-sm tabular-nums">
            {report.openHomeAttendees}
          </p>
          <p className="font-body text-xs text-muted mt-0.5">Open Home</p>
        </div>
        <div>
          <p className="font-mono font-medium text-foreground text-sm tabular-nums">
            {report.privateInspections}
          </p>
          <p className="font-body text-xs text-muted mt-0.5">Private Inspections</p>
        </div>
      </div>

      {/* Footer: agent + days on market + actions */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <p className="font-body text-xs text-muted">{report.agent}</p>
        <div className="flex items-center gap-3">
          <p className="font-body text-xs text-muted">
            {report.daysOnMarket} days on market
          </p>
          {isDraft && draft && <ApproveDraftButton draftId={draft.id} />}
          {vendorToken && <ShareButton token={vendorToken} />}
          <Link
            href={`/report/${linkId}`}
            className="font-body text-xs font-medium text-accent hover:underline whitespace-nowrap"
          >
            View Report →
          </Link>
        </div>
      </div>
    </div>
  );
}
