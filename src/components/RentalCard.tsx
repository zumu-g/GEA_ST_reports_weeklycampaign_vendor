import Link from "next/link";
import { RentalPropertyData } from "@/lib/rental-loader";

interface RentalCardProps {
  rental: RentalPropertyData;
  token?: string | null;
}

export default function RentalCard({ rental, token }: RentalCardProps) {
  const latest = rental.analytics[0];
  const totalViews = latest ? latest.reaViews + latest.domainViews : 0;
  const totalEnquiries = latest ? latest.reaEnquiries + latest.domainEnquiries : 0;
  const applications = latest?.applications ?? 0;

  return (
    <div className="bg-card-bg rounded border border-border p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-display text-xl font-normal leading-snug tracking-tight text-foreground">
            {rental.address}
          </h3>
          <p className="font-body text-sm text-muted mt-0.5">{rental.landlord}</p>
        </div>
        <span className="rounded px-3 py-1 text-xs font-medium font-body bg-surface text-foreground border border-border whitespace-nowrap flex-shrink-0">
          Rental
        </span>
      </div>

      <p className="font-mono text-2xl font-medium text-foreground tabular-nums leading-none mb-4">
        {rental.rentPw || "TBC"}
      </p>

      <div className="border-t border-border mb-4" />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="font-mono font-medium text-foreground text-sm tabular-nums">
            {totalViews.toLocaleString()}
          </p>
          <p className="font-body text-xs text-muted mt-0.5">Total Views</p>
        </div>
        <div>
          <p className="font-mono font-medium text-foreground text-sm tabular-nums">
            {totalEnquiries}
          </p>
          <p className="font-body text-xs text-muted mt-0.5">Enquiries</p>
        </div>
        <div>
          <p className="font-mono font-medium text-foreground text-sm tabular-nums">
            {applications}
          </p>
          <p className="font-body text-xs text-muted mt-0.5">Applications</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <p className="font-body text-xs text-muted">{rental.agent}</p>
        <div className="flex items-center gap-3">
          <Link
            href="/generate/rental"
            className="font-body text-xs text-accent hover:underline"
          >
            New report
          </Link>
          {token && (
            <a
              href={`/landlord/${token}`}
              className="font-body text-xs text-muted hover:text-foreground"
            >
              View portal →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
