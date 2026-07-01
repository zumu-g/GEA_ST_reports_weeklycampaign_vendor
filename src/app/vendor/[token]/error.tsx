'use client';

// Route-level error boundary for the vendor dashboard. Catches any read/render
// failure and shows a warm, on-brand message with a retry — never a stack trace,
// and never the token or slug (which would leak into a shared screenshot).
export default function VendorError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-5xl font-medium text-foreground mb-2">GEA</p>
      <div className="h-0.5 w-12 bg-accent rounded-full mx-auto my-6" />
      <h1 className="font-display text-2xl font-medium text-foreground mb-3">
        We couldn&apos;t load your dashboard
      </h1>
      <p className="font-body text-sm text-muted max-w-xs leading-relaxed mb-8">
        Something went wrong fetching your latest campaign data. This is usually
        temporary — please try again in a moment.
      </p>
      <button
        onClick={reset}
        className="font-body text-sm font-medium text-foreground border border-border rounded-md px-6 py-2.5 min-h-[44px] transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
      >
        Try again
      </button>
      <p className="font-body text-xs text-muted/60 mt-8">
        If this keeps happening, contact your agent.
      </p>
    </div>
  );
}
