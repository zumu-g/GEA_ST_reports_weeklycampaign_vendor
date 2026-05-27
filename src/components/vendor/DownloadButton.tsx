'use client';

export default function DownloadButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 min-h-[44px] text-sm font-medium font-body bg-surface text-foreground border border-border hover:border-accent hover:text-accent hover:opacity-90 active:scale-[0.97] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 14 14" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 1v8m0 0L4.5 6.5M7 9l2.5-2.5M2 11h10" />
      </svg>
      Download PDF
    </button>
  );
}
