import SectionHeading from '@/components/SectionHeading';
import type { VendorBuyer } from '@/lib/buyers';

interface InterestedBuyersProps {
  buyers: VendorBuyer[];
}

const POSITION_LABEL: Record<string, string> = {
  'finance-approved': 'Finance approved',
  cash: 'Cash buyer',
  'subject-to-sale': 'Subject to sale',
  'sold-own-home': 'Sold own home',
  investor: 'Investor',
  'first-home': 'First home buyer',
  unknown: 'Position unknown',
};

function interestStyles(interest: string): string {
  if (interest === 'High') return 'bg-accent/20 text-foreground';
  if (interest === 'Low') return 'bg-surface text-muted';
  return 'bg-primary/10 text-foreground';
}

export default function InterestedBuyers({ buyers }: InterestedBuyersProps) {
  if (buyers.length === 0) {
    return (
      <div className="mb-8">
        <SectionHeading label="Interested Buyers" count={buyers.length} />
        <div className="bg-card-bg rounded border border-border px-6 py-8 text-center">
          <p className="font-body text-sm text-foreground mb-1">No buyer feedback logged yet.</p>
          <p className="font-body text-xs text-muted">Your agent will add buyers here as feedback comes in from inspections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <SectionHeading label="Interested Buyers" count={buyers.length} />
      <ul className="bg-card-bg rounded border border-border overflow-hidden">
        {buyers.map((b, i) => (
          <li key={i} className="px-5 py-4 border-b border-border last:border-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-body text-sm font-medium text-foreground">{b.displayName}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium font-body ${interestStyles(b.interest)}`}>
                {b.interest} interest
              </span>
              <span className="font-body text-xs text-muted">{POSITION_LABEL[b.position] ?? b.position}</span>
            </div>
            {b.latestFeedback && (
              <p className="font-body text-sm text-foreground leading-snug">{b.latestFeedback}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
