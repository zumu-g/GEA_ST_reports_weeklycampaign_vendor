'use client';

import { useEffect, useState } from 'react';
import type { CampaignTask } from '@/lib/clickup-config';
import SectionHeading from '@/components/SectionHeading';

interface CampaignTimelineProps {
  slug: string;
}

function formatDueDate(dueDateMs: string | null): string {
  if (!dueDateMs) return '';
  const due = new Date(parseInt(dueDateMs));
  const now = new Date();
  const daysUntil = Math.floor((due.getTime() - now.getTime()) / 86_400_000);

  if (daysUntil < 0) return 'Overdue';
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil <= 7) return 'This week';
  if (daysUntil <= 14) return 'Next week';
  return due.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function dueDateColour(dueDateMs: string | null): string {
  if (!dueDateMs) return 'text-muted';
  const daysUntil = Math.floor((parseInt(dueDateMs) - Date.now()) / 86_400_000);
  if (daysUntil < 0) return 'text-red-500';
  if (daysUntil <= 7) return 'text-accent';
  return 'text-muted';
}

export default function CampaignTimeline({ slug }: CampaignTimelineProps) {
  const [tasks, setTasks] = useState<CampaignTask[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/vendor/campaign-tasks/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => {
        setTasks(d.tasks ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [slug]);

  if (!loaded) return null;
  if (tasks.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionHeading label="What's Next" count={tasks.length} />
      <ul className="bg-card-bg rounded border border-border overflow-hidden">
        {tasks.map((task) => {
          const label = formatDueDate(task.dueDate);
          const colour = dueDateColour(task.dueDate);
          return (
            <li
              key={task.id}
              className="px-5 py-3.5 border-b border-border last:border-0 flex items-center gap-3"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-0.5" />
              <span className="font-body text-sm text-foreground flex-1 leading-snug">
                {task.name}
              </span>
              {label && (
                <span className={`font-mono text-xs tabular-nums flex-shrink-0 ${colour}`}>
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
