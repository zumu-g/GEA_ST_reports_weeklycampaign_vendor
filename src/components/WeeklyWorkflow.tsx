"use client";

import { useEffect, useState } from "react";
import SyncVaultREButton from "./SyncVaultREButton";
import GenerateDraftsButton from "./GenerateDraftsButton";

const LAST_SYNC_KEY = "gea:lastSync";

function formatLastSync(ts: number): string {
  return new Date(ts).toLocaleString("en-AU", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The dashboard's single primary action: the Monday "start this week" flow.
 * Sync (step 1) then Generate drafts (step 2). Step 2 is genuinely gated until
 * a sync has happened — tracked in localStorage so it survives the page reload
 * SyncVaultREButton triggers on success.
 */
export default function WeeklyWorkflow({ weekEnding }: { weekEnding: string }) {
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    setLastSync(raw ? Number(raw) : null);
    setReady(true);
  }, []);

  const handleSynced = () => {
    const now = Date.now();
    localStorage.setItem(LAST_SYNC_KEY, String(now));
    setLastSync(now);
  };

  const synced = lastSync != null;

  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface border border-border font-mono text-[10px] text-muted">
            1
          </span>
          <SyncVaultREButton onSynced={handleSynced} />
        </span>
        <span className="font-body text-muted/50" aria-hidden>
          →
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full border font-mono text-[10px] transition-colors ${
              synced ? "bg-surface border-border text-muted" : "border-border/60 text-muted/40"
            }`}
          >
            2
          </span>
          <GenerateDraftsButton weekEnding={weekEnding} disabled={ready && !synced} />
        </span>
      </div>
      <p className="font-body text-xs text-muted/70 tabular-nums min-h-[1rem]">
        {!ready ? "" : synced ? `Last synced ${formatLastSync(lastSync!)}` : "Sync listings first to start this week"}
      </p>
    </div>
  );
}
