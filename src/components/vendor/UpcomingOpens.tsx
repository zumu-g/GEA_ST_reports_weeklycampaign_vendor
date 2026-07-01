import { readOpens, OpenEntry } from '@/lib/markdown-loader';
import { nowMs, today } from '@/lib/clock';
import EmptyState from './EmptyState';
import IcsDownload from './IcsDownload';
import SectionHeading from '@/components/SectionHeading';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function calendarGrid(opens: OpenEntry[]) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const startWeekday = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const openDays = new Set(
    opens
      .filter(o => {
        const d = new Date(o.start);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .map(o => new Date(o.start).getDate())
  );

  const cells: Array<{ day: number | null; hasOpen: boolean; isToday: boolean }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, hasOpen: false, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, hasOpen: openDays.has(d), isToday: d === now.getDate() });
  }
  return cells;
}

export default async function UpcomingOpens({ slug }: { slug: string }) {
  const all = await readOpens(slug);
  const upcoming = all
    .filter(o => new Date(o.start).getTime() >= nowMs())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 4);

  if (!upcoming.length) {
    return (
      <EmptyState
        label="Upcoming Opens"
        title="No open homes scheduled yet."
        hint="Your agent will list inspection times here as they're booked."
      />
    );
  }

  const cells = calendarGrid(all);
  const monthLabel = today().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  return (
    <section className="mb-12">
      <SectionHeading label="Upcoming Opens" count={upcoming.length} />

      <div className="bg-card-bg rounded border border-border p-5">
        <p className="font-body text-xs uppercase tracking-widest text-muted mb-3">{monthLabel}</p>
        <div className="grid grid-cols-7 gap-1 mb-5 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="font-body text-[10px] uppercase tracking-widest text-muted py-1">
              {d}
            </span>
          ))}
          {cells.map((c, i) => (
            <div
              key={i}
              className={[
                'aspect-square flex flex-col items-center justify-center rounded text-sm relative',
                c.day === null ? '' : 'bg-background',
                c.isToday ? 'ring-1 ring-accent' : '',
              ].join(' ')}
            >
              {c.day !== null && (
                <>
                  <span className="font-body text-foreground">{c.day}</span>
                  {c.hasOpen && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <ul className="divide-y divide-border border-t border-border">
          {upcoming.map(o => (
            <li key={o.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-sm text-foreground">
                  {fmtDate(o.start)} · {fmtTime(o.start)}-{fmtTime(o.end)}
                </p>
                {o.note && (
                  <p className="font-body text-xs text-muted truncate">{o.note}</p>
                )}
              </div>
              <IcsDownload open={o} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
