// Map a CRM report-listing into the dashboard's VendorReport shape.
//
// Used by the agent dashboard to source its listing SET from the CRM (so the
// app works on Railway, where the local markdown data dir doesn't exist). This
// is read-only/display mapping — gap values render as 0 on the summary cards,
// which is acceptable for the dashboard tiles. The richer gap-aware, agent-edit
// preserving flow stays in crm-draft-mapper.ts (weekly drafts).

import type { VendorReport } from '@/lib/types';
import type { ReportListing } from '@/lib/crm-client';
import { PORTAL_FIELD_MAP, COMBINED_FIELD_MAP } from '@/lib/crm-draft-mapper';
import { getReportWeekEnding } from '@/lib/weekly-drafts';

/** Latest non-null capturedAt across all stats, as the report's week-ending. */
function latestCapturedWeek(report: ReportListing): string {
  let latest: string | null = null;
  const consider = (capturedAt: string | null) => {
    if (capturedAt && (!latest || capturedAt > latest)) latest = capturedAt;
  };
  for (const stat of Object.values(report.stats ?? {})) consider(stat.capturedAt);
  for (const portal of Object.values(report.statsByPortal ?? {})) {
    for (const stat of Object.values(portal)) consider(stat.capturedAt);
  }
  // Normalise an ISO timestamp to a YYYY-MM-DD date; fall back to this week.
  return latest ? String(latest).slice(0, 10) : getReportWeekEnding();
}

export function crmReportToVendorReport(report: ReportListing): VendorReport {
  const l = report.listing;

  // Start every numeric field at 0, then fill from the CRM stat maps. Gaps stay 0.
  const numeric: Record<string, number> = {};
  for (const { field, portal, metric } of PORTAL_FIELD_MAP) {
    numeric[field as string] = report.statsByPortal?.[portal]?.[metric]?.value ?? 0;
  }
  for (const { field, metric } of COMBINED_FIELD_MAP) {
    numeric[field as string] = report.stats?.[metric]?.value ?? 0;
  }

  return {
    id: l.id,
    propertyAddress: l.propertyAddress,
    vendorName: l.vendorName ?? '',
    agent: l.agentName ?? '',
    weekEnding: latestCapturedWeek(report),
    listingDate: l.listedDate ?? '',
    askingPrice: l.priceGuide ?? 'TBC',
    reaViews: numeric.reaViews,
    reaEnquiries: numeric.reaEnquiries,
    reaSaves: numeric.reaSaves,
    reaSearchAppearances: numeric.reaSearchAppearances,
    domainViews: numeric.domainViews,
    domainEnquiries: numeric.domainEnquiries,
    domainSaves: numeric.domainSaves,
    domainSearchAppearances: numeric.domainSearchAppearances,
    openHomeAttendees: numeric.openHomeAttendees,
    privateInspections: numeric.privateInspections,
    campaignType: l.type ?? 'Private Sale',
    daysOnMarket: l.daysOnMarket ?? 0,
    messages: [],
  };
}
