"use client";

import { useEffect, useState } from "react";
import SectionHeading from "@/components/SectionHeading";
import type { SoldComp, ListingComp } from "@/lib/everypropertyai";

interface LocalMarketProps {
  address?: string;
  lat?: number | null;
  lng?: number | null;
  suburb?: string;
}

interface CompsData {
  solds: SoldComp[];
  listings: ListingComp[];
}

function money(n: number | null): string {
  if (n == null) return "Undisclosed";
  return `$${n.toLocaleString("en-AU")}`;
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

function listingPrice(l: ListingComp): string {
  if (l.displayPrice) return l.displayPrice;
  if (l.priceLow != null && l.priceHigh != null) return `${money(l.priceLow)} to ${money(l.priceHigh)}`;
  if (l.priceLow != null) return `From ${money(l.priceLow)}`;
  return "Contact agent";
}

function attributes(l: ListingComp): string {
  const parts: string[] = [];
  if (l.bedrooms != null) parts.push(`${l.bedrooms} bed`);
  if (l.bathrooms != null) parts.push(`${l.bathrooms} bath`);
  if (l.carSpaces != null) parts.push(`${l.carSpaces} car`);
  return parts.join("   ");
}

/** One comparable property card: thumbnail + address, price, agency, distance. */
function CompCard({
  imageUrl,
  address,
  locality,
  price,
  sub,
  agency,
  distanceMetres,
  href,
}: {
  imageUrl: string | null;
  address: string;
  locality?: string;
  price: string;
  sub?: string;
  agency?: string | null;
  distanceMetres: number | null;
  href?: string | null;
}) {
  const inner = (
    <div className="flex gap-3.5 py-3.5 border-t border-border first:border-t-0 group">
      <div className="flex-shrink-0 w-24 h-[4.5rem] rounded overflow-hidden bg-surface">
        {imageUrl ? (
          // Plain img (remote Domain CDN) to avoid a next.config remote-images change.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-body text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
            {address}
          </p>
          {distanceMetres != null && (
            <span className="flex-shrink-0 font-mono text-[11px] text-muted tabular-nums">{distanceMetres}m away</span>
          )}
        </div>
        {locality && <p className="font-body text-xs text-muted mt-0.5">{locality}</p>}
        <p className="font-mono text-sm font-medium text-foreground tabular-nums mt-1.5">
          {price}
          {sub && <span className="font-body text-xs text-muted ml-2">{sub}</span>}
        </p>
        {agency && <p className="font-body text-xs text-muted/80 mt-1 truncate">{agency}</p>}
      </div>
    </div>
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

function SkeletonRows() {
  return (
    <div className="animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3.5 py-3.5 border-t border-border first:border-t-0">
          <div className="w-24 h-[4.5rem] rounded bg-surface flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 bg-surface rounded w-3/4" />
            <div className="h-3 bg-surface rounded w-1/3" />
            <div className="h-3 bg-surface rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * "Just Sold" (3 closest sold sales) and "Just Listed" (3 newest on-market
 * listings) within 500m of the subject property, from the everypropertyAI
 * vendor-report endpoint. Each section is omitted when empty; the whole block
 * renders nothing when both are empty.
 */
export default function LocalMarket({ address, lat, lng, suburb }: LocalMarketProps) {
  const [data, setData] = useState<CompsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams();
    if (lat != null && lng != null) {
      qs.set("lat", String(lat));
      qs.set("lng", String(lng));
    } else if (address) {
      qs.set("address", address);
    }

    fetch(`/api/local-market?${qs.toString()}`)
      .then((r) => r.json())
      .then((d: CompsData) => {
        if (!cancelled) setData({ solds: d.solds ?? [], listings: d.listings ?? [] });
      })
      .catch(() => {
        if (!cancelled) setData({ solds: [], listings: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, lat, lng]);

  if (loading) {
    return (
      <section className="mb-12">
        <SectionHeading label="Just Sold" meta={<span className="font-body text-xs text-muted">Within 500m{suburb ? ` of ${suburb}` : ""}</span>} />
        <SkeletonRows />
      </section>
    );
  }

  const solds = data?.solds ?? [];
  const listings = data?.listings ?? [];
  if (solds.length === 0 && listings.length === 0) return null;

  return (
    <>
      {solds.length > 0 && (
        <section className="mb-12">
          <SectionHeading label="Just Sold" meta={<span className="font-body text-xs text-muted">Closest within 500m</span>} />
          <div>
            {solds.slice(0, 3).map((s, i) => (
              <CompCard
                key={`${s.rawAddress}-${i}`}
                imageUrl={s.imageUrl}
                address={s.rawAddress}
                locality={[s.suburb, s.postcode].filter(Boolean).join(" ")}
                price={money(s.salePrice)}
                sub={shortDate(s.saleDate) ? `Sold ${shortDate(s.saleDate)}` : undefined}
                agency={s.agencyName}
                distanceMetres={s.distanceMetres}
                href={s.listingUrl}
              />
            ))}
          </div>
        </section>
      )}

      {listings.length > 0 && (
        <section className="mb-12">
          <SectionHeading label="Just Listed" meta={<span className="font-body text-xs text-muted">Newest within 500m</span>} />
          <div>
            {listings.slice(0, 3).map((l, i) => (
              <CompCard
                key={`${l.rawAddress}-${i}`}
                imageUrl={l.imageUrl}
                address={l.rawAddress}
                locality={[l.suburb, l.postcode].filter(Boolean).join(" ")}
                price={listingPrice(l)}
                sub={attributes(l) || undefined}
                agency={l.agencyName}
                distanceMetres={l.distanceMetres}
                href={l.listingUrl}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
