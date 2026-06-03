/**
 * Campaign-week-aware narrative blocks.
 *
 * The narrative changes by campaign week (a parameter). Each block is a
 * function of the computed report context so numbers flow into the prose.
 * Tone matches the GEA generate-report system prompt: warm, plain-English,
 * "we" for the agency, trusted-advisor not corporate.
 */

/** Clamp any week >= 5 to the "5+" strategy block. */
export function narrativeWeek(week) {
  const w = Number(week) || 1;
  if (w <= 1) return 1;
  if (w >= 5) return 5;
  return w;
}

const FOCUS = {
  1: "Setup & launch",
  2: "Building momentum",
  3: "Qualifying interest",
  4: "Price-range review",
  5: "Strategy review",
};

export function weekFocus(week) {
  return FOCUS[narrativeWeek(week)];
}

/**
 * Build the narrative sections for the given week.
 * @param {object} ctx  computed report context (see generate.mjs)
 */
export function buildNarrative(ctx) {
  const w = narrativeWeek(ctx.week);
  const { totals, deltas, openHome } = ctx;
  const viewsTxt = totals.views != null ? totals.views.toLocaleString() : "—";
  const enqTxt = totals.enquiries != null ? String(totals.enquiries) : "—";
  const trend =
    deltas.views == null
      ? "We don't have a prior week to compare against yet"
      : deltas.views > 0
      ? `up ${deltas.views.toLocaleString()} on last week`
      : deltas.views < 0
      ? `down ${Math.abs(deltas.views).toLocaleString()} on last week`
      : "level with last week";

  const blocks = {
    1: {
      opening: `Welcome to your first weekly update for ${ctx.propertyAddress}. Your campaign is now live, and this report covers the opening days of what is typically the busiest period of the entire sale.`,
      focus: [
        "Your listing is live on realestate.com.au and domain.com.au with professional photography and copy approved and published.",
        "Both portals are confirmed and a “Just Listed” alert has gone to buyers with matching saved searches.",
        `We've logged an initial enquiry baseline of ${enqTxt} so far — the bulk of week-one enquiry usually lands on days two and three, so expect this to build.`,
        "Saves are a stronger early signal than raw views; we're watching those closely.",
      ],
      whatToExpect:
        "Expect a 5–10× drop in views from week one to week two — this is completely normal and not a cause for concern. The first open home is the most useful conversation we'll have.",
    },
    2: {
      opening: `We're into week two for ${ctx.propertyAddress}, where the picture shifts from launch noise to genuine buyer momentum. Here's how interest is tracking.`,
      focus: [
        `Online interest sits at ${viewsTxt} total views (${trend}).`,
        `Early buyer feedback is coming through inspections and enquiries — ${enqTxt} enquiries to date.`,
        "Our social campaign and EDM to the buyer database have extended reach beyond the portals themselves.",
        "We're starting to see which buyers are returning for a second look — a key momentum indicator.",
      ],
      whatToExpect:
        "Over the coming week we'll deepen follow-up with the most engaged buyers and use inspection feedback to sharpen how the home is presented online.",
    },
    3: {
      opening: `Week three is about qualifying the interest we've built for ${ctx.propertyAddress} — moving from “who's looking” to “who's serious”.`,
      focus: [
        `Total views are at ${viewsTxt} (${trend}), with ${enqTxt} enquiries.`,
        "We're assessing the depth of buyer interest: repeat inspections, finance position, and how our home compares to others buyers are weighing up.",
        "Comparable listings and recent sales nearby give us a read on where the market is placing your home.",
        "If any objections are emerging — price, condition, or location — we surface them here so we can address them deliberately.",
      ],
      whatToExpect:
        "Next week marks the four-week point, where we formally review the advertised price range against everything the market has told us.",
    },
    4: {
      opening: `We've reached the four-week mark for ${ctx.propertyAddress}. This is the point in every campaign where we step back and review the advertised price range against the market's response.`,
      focus: [
        `Across four weeks the campaign has drawn ${viewsTxt} views and ${enqTxt} enquiries (${trend}).`,
        `Open-home engagement is ${openHome.attendees} group(s) through to date.`,
        "We weigh three things together: online demand, inspection numbers, and direct buyer feedback on price.",
        deltas.views != null && deltas.views < 0
          ? "Softening online demand is a signal the current range may be ahead of where buyers are landing."
          : "Steady demand suggests the range is broadly aligned with buyer expectation — we'll confirm against direct feedback.",
      ],
      recommendation:
        "Our recommendation on the price range is set out in the agent's note below. Where buyer feedback and enquiry volume diverge from the asking range, we'll lay out the rationale for a hold or an adjustment clearly.",
      whatToExpect:
        "Whatever we decide on price, the goal is to keep your campaign in front of the buyers most likely to transact.",
    },
    5: {
      opening: `Your campaign for ${ctx.propertyAddress} has now run beyond the standard four weeks. At this stage we move into strategy options and a clear recommendation on the path forward.`,
      focus: [
        `Cumulative campaign reach is ${viewsTxt} views and ${enqTxt} enquiries (${trend}).`,
        "The options on the table are: extend the current campaign, adjust the price or sale method, take the home off-market to a select buyer pool, or withdraw and relaunch fresh.",
        "Each option carries a different trade-off between time on market, price, and buyer perception — we'll talk through which fits your circumstances.",
        "A listing that has been visible for several weeks benefits from a deliberate change of approach rather than simply waiting.",
      ],
      whatToExpect:
        "We'll agree a specific next step together this week so the campaign keeps moving with intent.",
    },
  };

  return blocks[w];
}
