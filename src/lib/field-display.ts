// Gap-aware display rule for CRM-sourced fields (plan U5 / origin G2, G3).
//
// The whole point: a missing value must read as "needs entry", never as a
// misleading 0. A genuinely captured 0 reads as "0". Provenance (source +
// recency) is surfaced as an optional hint when present.

import type { FieldSource } from '@/lib/types';

export interface FieldDisplay {
  /** What to render in place of the value. */
  text: string;
  /** True when the CRM had no data — render as a muted "needs entry" affordance. */
  isGap: boolean;
  /** Optional provenance hint, e.g. "rea · 20 Jun". Null when no source. */
  hint: string | null;
}

const GAP_TEXT = 'Needs entry';

function freshnessHint(src: FieldSource): string | null {
  if (!src.source) return null;
  if (!src.capturedAt) return src.source;
  const d = new Date(src.capturedAt);
  if (isNaN(d.getTime())) return src.source;
  const when = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  return `${src.source} · ${when}`;
}

/**
 * Decide how a field should display given its value and CRM provenance.
 * A `gap` source wins regardless of the value (the value is stale placeholder).
 */
export function fieldDisplay(
  value: number | string | null | undefined,
  src?: FieldSource,
): FieldDisplay {
  if (src?.gap) return { text: GAP_TEXT, isGap: true, hint: null };

  const text =
    typeof value === 'number'
      ? value.toLocaleString()
      : value == null
        ? ''
        : String(value);

  return { text, isGap: false, hint: src ? freshnessHint(src) : null };
}
