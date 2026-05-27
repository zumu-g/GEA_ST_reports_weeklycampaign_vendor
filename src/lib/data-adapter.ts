import { VendorReport, WeeklyDraft } from '@/lib/types';
import { PropertyData } from '@/lib/markdown-loader';

/**
 * Converts markdown PropertyData into the VendorReport format
 * that existing components (PropertyCard, PortalBreakdown, etc.) expect.
 */
export function propertyToVendorReport(property: PropertyData): VendorReport {
  // Get the latest analytics row (first row in the table, most recent)
  const latest = property.analytics[0];

  // Sum up open home and private inspection groups
  const openInspections = property.inspections.filter(
    (i) => i.type.toLowerCase().includes('open')
  );
  const privateInspections = property.inspections.filter(
    (i) => i.type.toLowerCase().includes('private')
  );
  const totalOpenGroups = openInspections.reduce((sum, i) => sum + i.groups, 0);
  const totalPrivateGroups = privateInspections.reduce((sum, i) => sum + i.groups, 0);

  // Calculate days on market — from listed date to the latest report's week-ending date
  const listedDate = property.listed ? new Date(property.listed) : new Date();
  const referenceDate = latest?.weekEnding ? new Date(latest.weekEnding) : new Date();
  const daysOnMarket = Math.floor(
    (referenceDate.getTime() - listedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    id: property.slug,
    propertyAddress: property.address,
    vendorName: property.owner,
    agent: property.agent,
    weekEnding: latest?.weekEnding || '',
    listingDate: property.listed,
    askingPrice: property.priceGuide,
    reaViews: latest?.reaViews || 0,
    reaEnquiries: latest?.reaEnquiries || 0,
    reaSaves: latest?.reaSaves || 0,
    reaSearchAppearances: 0,
    domainViews: latest?.domainViews || 0,
    domainEnquiries: latest?.domainEnquiries || 0,
    domainSaves: latest?.domainSaves || 0,
    domainSearchAppearances: 0,
    openHomeAttendees: totalOpenGroups,
    privateInspections: totalPrivateGroups,
    campaignType: property.campaignType,
    daysOnMarket: isNaN(daysOnMarket) ? 0 : daysOnMarket,
    messages: [],
  };
}

export function weeklyDraftToVendorReport(draft: WeeklyDraft): VendorReport {
  return {
    id: draft.id,
    propertyAddress: draft.propertyAddress,
    vendorName: draft.vendorName,
    agent: draft.agent,
    weekEnding: draft.weekEnding,
    listingDate: draft.listingDate,
    askingPrice: draft.askingPrice,
    reaViews: draft.reaViews,
    reaEnquiries: draft.reaEnquiries,
    reaSaves: draft.reaSaves,
    reaSearchAppearances: draft.reaSearchAppearances,
    domainViews: draft.domainViews,
    domainEnquiries: draft.domainEnquiries,
    domainSaves: draft.domainSaves,
    domainSearchAppearances: draft.domainSearchAppearances,
    openHomeAttendees: draft.openHomeAttendees,
    privateInspections: draft.privateInspections,
    campaignType: draft.campaignType,
    daysOnMarket: draft.daysOnMarket,
    status: draft.status,
    messages: draft.messages,
  };
}
