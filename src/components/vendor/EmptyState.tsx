import SectionHeading from '@/components/SectionHeading';

// Shown when a section a vendor would reasonably expect to see is not yet
// populated (new listing, data accrues weekly, etc.). Keeps the section titled
// so the page doesn't have unexplained gaps. Matches the inline inspections
// empty-state already used on the vendor page.
export default function EmptyState({
  label,
  title,
  hint,
}: {
  label: string;
  title: string;
  hint?: string;
}) {
  return (
    <section className="mb-10">
      <SectionHeading label={label} />
      <div className="bg-card-bg rounded border border-border px-6 py-10 text-center">
        <p className="font-body text-sm text-foreground mb-1">{title}</p>
        {hint && <p className="font-body text-xs text-muted">{hint}</p>}
      </div>
    </section>
  );
}
