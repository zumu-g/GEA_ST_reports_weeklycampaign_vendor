'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface LivePayload {
  openInProgress: boolean;
  groupsNow: number;
  lastActivityId: string | null;
  buyerCount: number;
  statsCapturedAt: string | null;
}

const OPEN_IN_PROGRESS_POLL_MS = 20_000;
const IDLE_POLL_MS = 60_000;

// Invisible — polls /api/vendor/live/[token] and calls router.refresh()
// (a normal server re-render of the page) whenever anything in the payload
// changed, rather than rendering its own copy of the data (KTD4).
export default function LiveRefresh({ token }: { token: string }) {
  const router = useRouter();
  const lastPayload = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const poll = useCallback(async () => {
    if (document.visibilityState !== 'visible') {
      schedule(IDLE_POLL_MS);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/vendor/live/${token}`, { cache: 'no-store' });
      if (res.ok) {
        const data: LivePayload = await res.json();
        const serialised = JSON.stringify(data);
        if (serialised !== lastPayload.current) {
          lastPayload.current = serialised;
          router.refresh();
        }
        schedule(data.openInProgress ? OPEN_IN_PROGRESS_POLL_MS : IDLE_POLL_MS);
        return;
      }
    } catch {
      // Transient — retry on the next scheduled tick.
    } finally {
      inFlight.current = false;
    }
    schedule(IDLE_POLL_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, router]);

  function schedule(ms: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(poll, ms);
  }

  useEffect(() => {
    poll();
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  return null;
}
