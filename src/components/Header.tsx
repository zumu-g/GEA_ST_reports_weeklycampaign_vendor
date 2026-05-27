"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border print:hidden">
      <div className="max-w-7xl mx-auto px-10">
        <div className="flex items-center justify-between h-14">

          {/* Logo + wordmark */}
          <Link href="/" className="flex items-center gap-4">
            <span className="font-display text-accent tracking-widest text-sm leading-none">GEA</span>
            <span className="w-px h-5 bg-border flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-body font-medium text-foreground text-sm leading-tight">
                Grants Estate Agents
              </span>
              <span className="eyebrow text-[11px] mt-0.5">
                Vendor Reports
              </span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="font-body text-sm text-muted hover:text-foreground transition-colors duration-150"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/onboard"
              className="font-body text-sm text-muted hover:text-foreground transition-colors duration-150"
            >
              New Property
            </Link>
            <Link
              href="/generate"
              className="font-body rounded-md px-5 py-2 text-sm font-medium bg-primary text-background hover:opacity-90 active:scale-[0.97] transition duration-150"
            >
              Generate Report
            </Link>
          </nav>

        </div>
      </div>
    </header>
  );
}
