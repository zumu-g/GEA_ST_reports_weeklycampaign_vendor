"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GenerateDraftsButtonProps {
  weekEnding: string;
}

function formatWeekEnding(weekEnding: string): string {
  // weekEnding is an ISO date string (e.g. "2026-05-30")
  const d = new Date(`${weekEnding}T00:00:00`);
  if (isNaN(d.getTime())) return weekEnding;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function GenerateDraftsButton({ weekEnding }: GenerateDraftsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const weekLabel = formatWeekEnding(weekEnding);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/weekly-drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekEnding }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate drafts");
      setResult({ created: data.created ?? 0, skipped: data.skipped ?? 0 });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {result && !error && (
        <span className="font-body text-xs text-muted">
          {result.created} created{result.skipped > 0 ? `, ${result.skipped} already exist` : ""}
        </span>
      )}
      {error && (
        <span className="font-body text-xs text-danger" title={error}>
          Couldn’t generate — {error}
        </span>
      )}
      <button
        onClick={handleGenerate}
        disabled={loading}
        title="Run after syncing listings — creates a blank draft for each property"
        className="h-9 rounded px-4 font-body text-sm font-medium bg-accent text-primary hover:bg-accent/80 disabled:opacity-50 disabled:cursor-wait transition-all whitespace-nowrap"
      >
        {loading ? "Generating…" : `Generate Drafts — week ending ${weekLabel}`}
      </button>
    </div>
  );
}
