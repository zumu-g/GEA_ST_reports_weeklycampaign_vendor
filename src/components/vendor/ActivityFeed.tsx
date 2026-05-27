import { getUnifiedTimeline, TimelineEntry } from '@/lib/markdown-loader';
import SectionHeading from '@/components/SectionHeading';

const sourceLabels: Record<TimelineEntry['source'], { label: string; dot: string }> = {
  clickup: { label: 'Campaign', dot: 'bg-blue-500' },
  telegram: { label: 'Note', dot: 'bg-sky-500' },
  analytics: { label: 'Report', dot: 'bg-emerald-500' },
  inspection: { label: 'Inspection', dot: 'bg-amber-500' },
  comment: { label: 'Comment', dot: 'bg-accent' },
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function ActivityFeed({ slug }: { slug: string }) {
  const entries = await getUnifiedTimeline(slug, { limit: 20 });

  if (entries.length === 0) return null;

  return (
    <section className="mb-12">
      <SectionHeading label="Recent Activity" count={entries.length} />
      <ol className="bg-card-bg rounded border border-border divide-y divide-border">
        {entries.map(e => {
          const meta = sourceLabels[e.source];
          return (
            <li key={e.id} className="px-5 py-4 flex items-start gap-3">
              <span className={`mt-1.5 w-2 h-2 rounded-full ${meta.dot} flex-shrink-0`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3 mb-0.5">
                  <p className="font-body text-[10px] uppercase tracking-widest text-muted">
                    {meta.label} · {e.actor}
                  </p>
                  <p className="font-body text-[10px] text-muted whitespace-nowrap">{formatTime(e.ts)}</p>
                </div>
                <p className="font-body text-sm text-foreground leading-relaxed break-words">
                  {e.body || e.summary}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
