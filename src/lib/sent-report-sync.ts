// Best-effort sync of weekly-report lifecycle into the CRM sent-report log.
//
// These helpers NEVER throw and NEVER block the caller (KTD4): a CRM failure is
// logged and left for the next upsert to reconcile (the CRM upserts on
// (listing, weekEnding), so re-approve/re-send self-heals — KTD3). The listing
// is keyed by address (KTD5), resolved CRM-side.

import { recordSentReport, isCrmConfigured } from '@/lib/crm-client';

function portalUrlFor(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${base}${path}`;
}

/** Record an `approved` sent-report when an agent approves a weekly draft. */
export async function recordApprovedReport(input: {
  address: string;
  weekEnding: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  portalPath?: string | null; // e.g. /vendor/<token>
}): Promise<void> {
  if (!isCrmConfigured()) return;
  try {
    const res = await recordSentReport({
      address: input.address,
      weekEnding: input.weekEnding,
      status: 'approved',
      approvedBy: input.approvedBy ?? null,
      approvedAt: input.approvedAt ?? new Date().toISOString(),
      portalUrl: input.portalPath ? portalUrlFor(input.portalPath) : null,
    });
    if (!res.ok) {
      console.warn('[sent-report-sync] approved write failed, will reconcile on next write:', res.error);
    }
  } catch (err) {
    console.warn('[sent-report-sync] approved write threw (swallowed):', err);
  }
}

/** Stamp the record `sent` when a report is delivered to the owner. */
export async function recordSentReportDelivery(input: {
  address: string;
  weekEnding: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  channel?: string | null;
  portalPath?: string | null;
}): Promise<void> {
  if (!isCrmConfigured()) return;
  try {
    const res = await recordSentReport({
      address: input.address,
      weekEnding: input.weekEnding,
      status: 'sent',
      sentAt: new Date().toISOString(),
      recipientName: input.recipientName ?? null,
      recipientEmail: input.recipientEmail ?? null,
      channel: input.channel ?? null,
      portalUrl: input.portalPath ? portalUrlFor(input.portalPath) : null,
    });
    if (!res.ok) {
      console.warn('[sent-report-sync] sent write failed, will reconcile on next write:', res.error);
    }
  } catch (err) {
    console.warn('[sent-report-sync] sent write threw (swallowed):', err);
  }
}
