/**
 * "We Do / You Do" two-column campaign checklist.
 *
 * State is driven by the input data and the campaign week rather than
 * hardcoded, so the checklist reflects the actual week.
 */
import { narrativeWeek } from "./narrative.mjs";

/**
 * @param {object} ctx report context
 * @returns {{ weDo: {label:string,done:boolean}[], youDo: {label:string,done:boolean}[] }}
 */
export function buildChecklist(ctx) {
  const w = narrativeWeek(ctx.week);
  const { totals, openHome, input } = ctx;
  const hasViews = (totals.views ?? 0) > 0;
  const hadOpenHome = (openHome.attendees ?? 0) > 0 || (openHome.groups ?? 0) > 0;
  const overrides = input.checklist ?? {};

  // Default state inferred from data + week, overridable via input.checklist.
  const weDo = [
    { key: "portalUpload", label: "Listing uploaded to REA & Domain", done: hasViews },
    { key: "photos", label: "Professional photography & copy live", done: hasViews },
    { key: "social", label: "Social media campaign running", done: w >= 1 },
    { key: "openHomes", label: "Open homes scheduled & run", done: hadOpenHome },
    { key: "buyerFollowUp", label: "Buyer enquiry follow-up", done: (totals.enquiries ?? 0) > 0 },
    { key: "weeklyReporting", label: "Weekly vendor reporting", done: true },
    { key: "priceReview", label: "Price-range review (week 4)", done: w >= 4 && !!input.priceReviewLogged },
  ];

  const youDo = [
    { key: "approveRange", label: "Approve price-range adjustments", done: !!input.ownerApprovedRange },
    { key: "styling", label: "Presentation / styling tasks complete", done: input.stylingDone ?? hasViews },
    { key: "availability", label: "Confirm availability for inspections", done: input.availabilityConfirmed ?? hadOpenHome },
    { key: "offerDecisions", label: "Decisions on offers as they arrive", done: !!input.offerDecisionsMade },
  ];

  const apply = (items) =>
    items.map((it) => ({
      label: it.label,
      done: overrides[it.key] !== undefined ? !!overrides[it.key] : it.done,
    }));

  return { weDo: apply(weDo), youDo: apply(youDo) };
}
