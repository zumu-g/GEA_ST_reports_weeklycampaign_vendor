'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center min-h-[44px] font-body text-xs uppercase tracking-widest text-accent hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Save as PDF
    </button>
  );
}
