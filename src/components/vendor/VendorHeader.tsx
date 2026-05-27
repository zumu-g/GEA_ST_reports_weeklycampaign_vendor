import Link from 'next/link';

interface VendorHeaderProps {
  address: string;
  daysOnMarket: number;
  token?: string;
}

export default function VendorHeader({ address, daysOnMarket, token }: VendorHeaderProps) {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10 print:hidden">
      <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display font-medium text-foreground text-base tracking-tight flex-shrink-0">
            GEA
          </span>
          <span className="w-px h-4 bg-border flex-shrink-0" />
          <p className="font-body text-xs text-muted truncate">{address}</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {token && (
            <Link
              href={`/vendor/${token}/guides`}
              className="inline-flex items-center min-h-[44px] -my-2 font-body text-[10px] uppercase tracking-widest text-muted hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Resources
            </Link>
          )}
          {daysOnMarket > 0 && (
            <div className="flex items-baseline gap-1.5">
              <p className="font-mono text-sm font-medium text-foreground tabular-nums leading-none">
                {daysOnMarket}
              </p>
              <p className="font-body text-[10px] text-muted leading-none">days</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
