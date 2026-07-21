// Skeleton placeholder for a streamed section (used as a <Suspense> fallback
// so the shell paints while a slow/external section loads). Uses design tokens
// only — no new colours.

function Bar({ className = '' }: { className?: string }) {
  return <div className={`bg-surface rounded animate-pulse ${className}`} />;
}

export function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <section className="mb-10" aria-hidden="true">
      <Bar className="h-3 w-24 mb-4" />
      <div className="bg-card-bg rounded border border-border p-5 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Bar key={i} className={`h-4 ${i === 0 ? 'w-3/4' : i === lines - 1 ? 'w-1/2' : 'w-full'}`} />
        ))}
      </div>
    </section>
  );
}
