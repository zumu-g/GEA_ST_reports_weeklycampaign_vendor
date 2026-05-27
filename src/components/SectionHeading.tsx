import type { ReactNode } from 'react';

interface SectionHeadingProps {
  /** Heading text — rendered uppercase as the eyebrow. */
  label: string;
  /** Optional figure shown on the right in mono (e.g. a count). */
  count?: string | number;
  /** Optional right-side content used when there is no count (e.g. "Week ending …"). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Warm Editorial Studio signature section heading (DESIGN.md): an uppercase
 * label-caps eyebrow in `muted` with an optional mono-figure count on the right,
 * sitting on a 1px `rule` bottom border. Uses the `.section-head`/`.eyebrow`
 * helper classes from globals.css.
 */
export default function SectionHeading({ label, count, meta, className = '' }: SectionHeadingProps) {
  return (
    <div className={`section-head mb-6 ${className}`}>
      <h2 className="eyebrow">{label}</h2>
      {count != null ? (
        <span className="section-head__count tabular-nums">{count}</span>
      ) : (
        meta
      )}
    </div>
  );
}
