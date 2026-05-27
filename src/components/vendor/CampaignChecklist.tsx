'use client';

import { useEffect, useState } from 'react';
import SectionHeading from '@/components/SectionHeading';

interface ChecklistItem {
  task: string;
  done: boolean;
}

interface CampaignChecklistProps {
  items: ChecklistItem[];
  storageKey?: string;
}

export default function CampaignChecklist({ items, storageKey }: CampaignChecklistProps) {
  const [state, setState] = useState<ChecklistItem[]>(items);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, boolean>;
      setState(prev => prev.map(i => (i.task in saved ? { ...i, done: saved[i.task] } : i)));
    } catch {}
  }, [storageKey]);

  const toggle = (idx: number) => {
    setState(prev => {
      const next = prev.map((it, i) => (i === idx ? { ...it, done: !it.done } : it));
      if (storageKey) {
        try {
          const map: Record<string, boolean> = {};
          next.forEach(it => { map[it.task] = it.done; });
          localStorage.setItem(storageKey, JSON.stringify(map));
        } catch {}
      }
      return next;
    });
  };

  const completed = state.filter(i => i.done).length;
  const currentIdx = state.findIndex(i => !i.done);
  const stageLabel =
    completed === 0
      ? 'Not started'
      : currentIdx === -1
      ? 'All complete'
      : `Up to: ${state[currentIdx].task}`;

  return (
    <div className="mb-10">
      <SectionHeading label="Your Checklist" count={`${completed}/${state.length}`} />
      <p className="font-body text-xs text-muted mb-3 -mt-3">{stageLabel}</p>

      {/* Progress bar */}
      <div className="h-1 bg-surface rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all"
          style={{ width: `${state.length ? (completed / state.length) * 100 : 0}%` }}
        />
      </div>

      <ul>
        {state.map((item, i) => (
          <li
            key={i}
            className="py-3 border-b border-border last:border-0 flex items-center gap-3"
          >
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={item.done}
              aria-label={`${item.done ? 'Mark incomplete' : 'Mark complete'}: ${item.task}`}
              className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                item.done
                  ? 'bg-accent border-accent'
                  : 'bg-transparent border-border'
              }`}
            >
              {item.done && (
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
            </button>
            <button
              type="button"
              onClick={() => toggle(i)}
              className={`font-body text-sm text-left flex-1 cursor-pointer ${
                item.done ? 'text-foreground line-through decoration-muted/40' : 'text-muted'
              }`}
            >
              {item.task}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
