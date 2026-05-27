import SectionHeading from '@/components/SectionHeading';

interface CommunicationRow {
  date: string;
  type: string;
  summary: string;
}

interface CommunicationsLogProps {
  communications: CommunicationRow[];
}

function typeStyles(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('sms') || t.includes('phone')) return 'bg-primary/10 text-foreground';
  if (t.includes('email')) return 'bg-accent/20 text-foreground';
  if (t.includes('portal')) return 'bg-surface text-muted';
  return 'bg-surface text-muted';
}

export default function CommunicationsLog({ communications }: CommunicationsLogProps) {
  if (communications.length === 0) {
    return (
      <div className="mb-8">
        <SectionHeading label="Communications" count={communications.length} />
        <div className="bg-card-bg rounded border border-border px-6 py-8 text-center">
          <p className="font-body text-sm text-foreground mb-1">No messages yet.</p>
          <p className="font-body text-xs text-muted">Your agent will post updates here after each inspection and when there is news on your sale.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <SectionHeading label="Communications" count={communications.length} />
      <ul className="bg-card-bg rounded border border-border overflow-hidden">
        {communications.map((comm, i) => (
          <li
            key={i}
            className="px-5 py-4 border-b border-border last:border-0 flex gap-4 items-start"
          >
            <div className="flex-shrink-0 pt-0.5">
              <span className="font-mono text-xs text-muted">{comm.date}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium font-body ${typeStyles(comm.type)}`}
                >
                  {comm.type}
                </span>
              </div>
              <p className="font-body text-sm text-foreground leading-snug">{comm.summary}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
