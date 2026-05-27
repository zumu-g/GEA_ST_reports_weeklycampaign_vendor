"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DraftActionsProps {
  draftId: string;
}

export default function DraftActions({ draftId }: DraftActionsProps) {
  const [approving, setApproving] = useState(false);
  const router = useRouter();

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/weekly-drafts/${draftId}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Link
        href={`/generate?draftId=${draftId}`}
        className="h-9 rounded-md px-4 font-body text-sm font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
      >
        Edit Draft
      </Link>
      <button
        onClick={handleApprove}
        disabled={approving}
        className="h-9 rounded-md px-4 font-body text-sm font-medium bg-accent text-primary hover:bg-accent/80 disabled:opacity-50 disabled:cursor-wait transition-all"
      >
        {approving ? "Approving…" : "Approve Report"}
      </button>
    </div>
  );
}
