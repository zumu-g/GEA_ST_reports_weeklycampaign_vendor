import { getUnifiedTimeline, TimelineEntry } from '@/lib/markdown-loader';

const sourceDot: Record<TimelineEntry['source'], string> = {
  clickup: 'bg-blue-500',
  telegram: 'bg-sky-500',
  analytics: 'bg-emerald-500',
  inspection: 'bg-amber-500',
  comment: 'bg-accent',
};

function relativeTime(ts: string): string {
  const d = new Date(ts).getTime();
  if (isNaN(d)) return '';
  const diff = Date.now() - d;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export default async function ActivityTicker({ slug }: { slug: string }) {
  const entries = (await getUnifiedTimeline(slug, { limit: 5 })).slice(0, 5);
  if (!entries.length) return null;

  return (
    <div
      className="ticker group bg-card-bg border border-border rounded overflow-hidden"
      aria-label="Recent activity"
    >
      <div className="ticker-track flex flex-col group-hover:[animation-play-state:paused]">
        {entries.map(e => (
          <div
            key={e.id}
            className="ticker-item flex items-center gap-3 px-4 py-3 min-h-[44px]"
          >
            <span className={`w-2 h-2 rounded-full ${sourceDot[e.source]} flex-shrink-0`} />
            <p className="font-body text-sm text-foreground truncate flex-1">
              {e.body || e.summary}
            </p>
            <span className="font-body text-[10px] uppercase tracking-widest text-muted whitespace-nowrap">
              {relativeTime(e.ts)}
            </span>
          </div>
        ))}
      </div>
      <style>{`
        .ticker { height: 44px; }
        .ticker-track {
          animation: ticker-rotate ${entries.length * 4}s steps(${entries.length}) infinite;
        }
        @keyframes ticker-rotate {
          to { transform: translateY(-${entries.length * 44}px); }
        }
        @media (max-width: 640px) {
          .ticker-track { animation: none; }
          .ticker-item:not(:first-child) { display: none; }
        }
      `}</style>
    </div>
  );
}
