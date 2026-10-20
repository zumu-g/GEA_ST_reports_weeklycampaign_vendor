'use client';

import { useState } from 'react';

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function supportsPush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export default function NotificationOptIn({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');

  if (!supportsPush()) {
    return (
      <p className="font-body text-xs text-muted">
        Install this page to your home screen to enable notifications (Share → Add to Home Screen).
      </p>
    );
  }

  async function subscribe() {
    setState('subscribing');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('idle');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setState('error');
        return;
      }
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await fetch(`/api/vendor/push/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState('subscribed');
    } catch {
      setState('error');
    }
  }

  if (state === 'subscribed') {
    return <p className="font-body text-xs text-muted">Notifications on.</p>;
  }

  return (
    <button
      onClick={subscribe}
      disabled={state === 'subscribing'}
      className="font-body text-sm underline text-accent disabled:opacity-50"
    >
      {state === 'subscribing' ? 'Enabling…' : 'Notify me of updates'}
    </button>
  );
}
