/**
 * Auto-flagged alert conditions. Each rule inspects the report context and
 * returns an alert object when triggered. Alerts surface to the agent (and
 * appear in an internal section of the report) — they are not vendor-facing
 * sales spin.
 */
import { narrativeWeek } from "./narrative.mjs";

const HIGH_VIEWS_THRESHOLD = 150; // "high views" benchmark for the price-signal rule

/** @param {object} ctx report context */
export function buildAlerts(ctx) {
  const alerts = [];
  const { totals, deltas, openHome, missingPortals, input } = ctx;
  const w = narrativeWeek(ctx.week);

  // No portal PDF received
  for (const p of missingPortals) {
    alerts.push({
      level: "warn",
      code: "missing-portal-pdf",
      message: `No ${p === "rea" ? "realestate.com.au" : "Domain"} report received this week — stats for that portal are incomplete.`,
    });
  }

  // Views dropped week-on-week
  if (deltas.views != null && deltas.views < 0) {
    alerts.push({
      level: "info",
      code: "views-down",
      message: `Total views fell ${Math.abs(deltas.views).toLocaleString()} versus last week.`,
    });
  }

  // Zero enquiries despite high views (price signal)
  if ((totals.views ?? 0) >= HIGH_VIEWS_THRESHOLD && (totals.enquiries ?? 0) === 0) {
    alerts.push({
      level: "warn",
      code: "high-views-no-enquiries",
      message: `${(totals.views ?? 0).toLocaleString()} views but zero enquiries — classic price-signal; raise the advertised range as a topic.`,
    });
  }

  // Open-home attendance declining
  if (
    openHome.previousAttendees != null &&
    openHome.attendees != null &&
    openHome.attendees < openHome.previousAttendees
  ) {
    alerts.push({
      level: "info",
      code: "open-home-declining",
      message: `Open-home attendance down (${openHome.previousAttendees} → ${openHome.attendees} groups).`,
    });
  }

  // Week 4 reached with no price review logged
  if (w >= 4 && !input.priceReviewLogged) {
    alerts.push({
      level: "warn",
      code: "week4-no-price-review",
      message: "Week 4 reached but no price-range review has been logged. Complete the review before sending.",
    });
  }

  return alerts;
}
