import { VendorReport } from "@/lib/types";

interface PortalBreakdownProps {
  report: VendorReport;
}

interface PortalPanelProps {
  name: string;
  dotColor: string;
  stats: { label: string; value: number }[];
}

function PortalPanel({ name, dotColor, stats }: PortalPanelProps) {
  return (
    <div className="bg-card-bg rounded-lg border border-border overflow-hidden">
      <div className="p-6">
        {/* Portal name */}
        <div className="flex items-center gap-2 mb-5">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          <span className="font-body font-semibold text-sm text-foreground tracking-wide">
            {name}
          </span>
        </div>

        {/* Metric rows — label left, figure right, separated by hairlines (no nested boxes) */}
        <div className="divide-y divide-border">
          {stats.map(({ label, value }) => (
            <div key={label} className="flex items-baseline justify-between py-3 first:pt-0 last:pb-0">
              <span className="font-body text-sm text-muted">{label}</span>
              <span className="font-mono text-lg font-medium tabular-nums text-foreground">
                {value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PortalBreakdown({ report }: PortalBreakdownProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <PortalPanel
        name="realestate.com.au"
        dotColor="#EF4444"
        stats={[
          { label: "Views", value: report.reaViews },
          { label: "Enquiries", value: report.reaEnquiries },
          { label: "Saves", value: report.reaSaves },
          { label: "Search Appearances", value: report.reaSearchAppearances },
        ]}
      />
      <PortalPanel
        name="domain.com.au"
        dotColor="#10B981"
        stats={[
          { label: "Views", value: report.domainViews },
          { label: "Enquiries", value: report.domainEnquiries },
          { label: "Saves", value: report.domainSaves },
          { label: "Search Appearances", value: report.domainSearchAppearances },
        ]}
      />
    </div>
  );
}
