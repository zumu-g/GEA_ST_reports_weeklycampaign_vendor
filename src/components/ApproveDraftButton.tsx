"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApproveDraftButton({ draftId }: { draftId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

  async function handleApprove() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/weekly-drafts/${draftId}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Approve failed");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className={`rounded px-3 py-1 text-xs font-medium font-body border transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-wait ${
        error
          ? "bg-danger/8 text-danger border-danger/25"
          : "bg-accent/15 text-accent border-accent/30 hover:bg-accent/25"
      }`}
    >
      {loading ? "Approving…" : error ? "Retry approve" : "Approve"}
    </button>
  );
}
