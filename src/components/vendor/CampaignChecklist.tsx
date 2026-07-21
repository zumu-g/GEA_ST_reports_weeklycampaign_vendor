'use client';

import { useEffect, useState } from 'react';
import SectionHeading from '@/components/SectionHeading';

type ChecklistStatus = 'todo' | 'doing' | 'done';

interface ChecklistItem {
  task: string;
  // `status` is authoritative when present; otherwise derived from `done`.
  // Both are optional so callers passing the legacy `{task, done}` shape (e.g.
  // the landlord/rental loader) remain compatible.
  status?: ChecklistStatus;
  done?: boolean;
}

interface CampaignChecklistProps {
  items: ChecklistItem[];
  storageKey?: string;
}

// todo -> doing -> done -> todo
const NEXT_STATUS: Record<ChecklistStatus, ChecklistStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
};

interface StatefulItem {
  task: string;
  status: ChecklistStatus;
}

function normaliseStatus(item: ChecklistItem): ChecklistStatus {
  if (item.status) return item.status;
  return item.done ? 'done' : 'todo';
}

export default function CampaignChecklist({ items, storageKey }: CampaignChecklistProps) {
  const [state, setState] = useState<StatefulItem[]>(() =>
    items.map(i => ({ task: i.task, status: normaliseStatus(i) })),
  );

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, ChecklistStatus | boolean>;
      // SSR-safe hydration from localStorage: must run in an effect, not the
      // useState initializer, to avoid a server/client hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(prev =>
        prev.map(i => {
          if (!(i.task in saved)) return i;
          const v = saved[i.task];
          // Legacy persisted shape was Record<string, boolean>.
          const status: ChecklistStatus =
            typeof v === 'boolean' ? (v ? 'done' : 'todo') : v;
          return { ...i, status };
        }),
      );
    } catch {}
  }, [storageKey]);

  const cycle = (idx: number) => {
    setState(prev => {
      const next = prev.map((it, i) =>
        i === idx ? { ...it, status: NEXT_STATUS[it.status] } : it,
      );
      if (storageKey) {
        try {
          const map: Record<string, ChecklistStatus> = {};
          next.forEach(it => {
            map[it.task] = it.status;
          });
          localStorage.setItem(storageKey, JSON.stringify(map));
        } catch {}
      }
      return next;
    });
  };

  const completed = state.filter(i => i.status === 'done').length;
  const inProgress = state.filter(i => i.status === 'doing').length;
  const currentIdx = state.findIndex(i => i.status !== 'done');
  const stageLabel =
    completed === 0 && inProgress === 0
      ? 'Not started'
      : currentIdx === -1
      ? 'All complete'
      : `Up to: ${state[currentIdx].task}`;

  return (
    <div className="mb-10">
      <SectionHeading label="Your Checklist" count={`${completed}/${state.length}`} />
      <p className="font-body text-xs text-muted mb-3 -mt-3">{stageLabel}</p>

      {/* Progress bar: done fills accent, in-progress shows a lighter segment */}
      <div className="h-1 bg-surface rounded-full mb-5 overflow-hidden flex">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${state.length ? (completed / state.length) * 100 : 0}%` }}
        />
        <div
          className="h-full bg-accent/40 transition-all"
          style={{ width: `${state.length ? (inProgress / state.length) * 100 : 0}%` }}
        />
      </div>

      <ul>
        {state.map((item, i) => {
          const isDone = item.status === 'done';
          const isDoing = item.status === 'doing';
          const nextLabel =
            item.status === 'todo'
              ? 'Mark in progress'
              : item.status === 'doing'
              ? 'Mark complete'
              : 'Reset to not started';
          return (
            <li
              key={i}
              className="py-3 border-b border-border last:border-0 flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => cycle(i)}
                aria-label={`${nextLabel}: ${item.task}`}
                title={nextLabel}
                className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                  isDone
                    ? 'bg-accent border-accent'
                    : isDoing
                    ? 'bg-accent/30 border-accent'
                    : 'bg-transparent border-border'
                }`}
              >
                {isDone && (
                  <svg aria-hidden="true" width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {isDoing && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-accent" />}
              </button>
              <button
                type="button"
                onClick={() => cycle(i)}
                className={`font-body text-sm text-left flex-1 cursor-pointer ${
                  isDone
                    ? 'text-foreground line-through decoration-muted/40'
                    : isDoing
                    ? 'text-foreground'
                    : 'text-muted'
                }`}
              >
                {item.task}
                {isDoing && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-accent font-medium">
                    In progress
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
