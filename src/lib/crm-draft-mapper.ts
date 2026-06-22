// Map a CRM report-listing response into weekly-draft fields.
//
// Rules (see plan KTD2/KTD3/KTD4):
//   - Agent edits always win: a field listed in draft.agentEdited is never
//     overwritten, and no provenance is recorded for it.
//   - Portal-split numeric fields come from statsByPortal (rea/domain); combined
//     counts (open homes, inspections) come from stats.
//   - Gap vs zero: a CRM gap leaves the field's value untouched but records
//     { gap: true } so the UI shows "needs entry". A real captured 0 records
//     { gap: false } and sets the value to 0.
//   - A null report (unresolved listing / CRM down) marks every mapped,
//     non-edited field as a gap.

import type { WeeklyDraft, FieldSource } from '@/lib/types';
import type { ReportListing, CrmStat } from '@/lib/crm-client';

/** Portal-split numeric fields: draft field <- statsByPortal[portal][metric]. */
const PORTAL_FIELD_MAP: { field: keyof WeeklyDraft; portal: string; metric: string }[] = [
  { field: 'reaViews', portal: 'rea', metric: 'views' },
  { field: 'reaEnquiries', portal: 'rea', metric: 'enquiries' },
  { field: 'reaSaves', portal: 'rea', metric: 'saves' },
  { field: 'reaSearchAppearances', portal: 'rea', metric: 'searchAppearances' },
  { field: 'domainViews', portal: 'domain', metric: 'views' },
  { field: 'domainEnquiries', portal: 'domain', metric: 'enquiries' },
  { field: 'domainSaves', portal: 'domain', metric: 'saves' },
  { field: 'domainSearchAppearances', portal: 'domain', metric: 'searchAppearances' },
];

/** Combined numeric fields: draft field <- stats[metric] (across all sources). */
const COMBINED_FIELD_MAP: { field: keyof WeeklyDraft; metric: string }[] = [
  { field: 'openHomeAttendees', metric: 'openHomes' },
  { field: 'privateInspections', metric: 'inspections' },
];

const GAP: FieldSource = { source: null, capturedAt: null, gap: true };

function statToSource(stat: CrmStat): FieldSource {
  return { source: stat.source, capturedAt: stat.capturedAt, gap: stat.gap };
}

/**
 * Return a new draft with CRM data applied. Non-mutating. Fields the agent has
 * edited are preserved untouched.
 */
export function applyCrmToDraft(draft: WeeklyDraft, report: ReportListing | null): WeeklyDraft {
  const edited = new Set(draft.agentEdited ?? []);
  const next: WeeklyDraft = { ...draft };
  const fieldSources: Record<string, FieldSource> = { ...(draft.fieldSources ?? {}) };

  const setNumeric = (field: keyof WeeklyDraft, stat: CrmStat | undefined) => {
    if (edited.has(field as string)) return;
    if (stat && !stat.gap && typeof stat.value === 'number') {
      (next[field] as number) = stat.value;
      fieldSources[field as string] = statToSource(stat);
    } else {
      // No data: keep existing value, mark as a gap so the UI shows "needs entry".
      fieldSources[field as string] = stat ? statToSource(stat) : GAP;
    }
  };

  const setMeta = (field: keyof WeeklyDraft, value: string | number | null) => {
    if (edited.has(field as string)) return;
    if (value !== null && value !== '' && value !== undefined) {
      (next[field] as string | number) = value;
      fieldSources[field as string] = { source: 'crm', capturedAt: null, gap: false };
    } else {
      fieldSources[field as string] = GAP;
    }
  };

  if (!report) {
    // Unresolved listing / CRM unavailable: mark all mapped non-edited fields gap.
    for (const { field } of [...PORTAL_FIELD_MAP, ...COMBINED_FIELD_MAP]) {
      if (!edited.has(field as string)) fieldSources[field as string] = GAP;
    }
    next.fieldSources = fieldSources;
    return next;
  }

  for (const { field, portal, metric } of PORTAL_FIELD_MAP) {
    setNumeric(field, report.statsByPortal?.[portal]?.[metric]);
  }
  for (const { field, metric } of COMBINED_FIELD_MAP) {
    setNumeric(field, report.stats?.[metric]);
  }

  const l = report.listing;
  setMeta('propertyAddress', l.propertyAddress);
  setMeta('askingPrice', l.priceGuide);
  setMeta('listingDate', l.listedDate);
  setMeta('daysOnMarket', l.daysOnMarket);
  setMeta('agent', l.agentName);
  setMeta('vendorName', l.vendorName);

  next.fieldSources = fieldSources;
  return next;
}
