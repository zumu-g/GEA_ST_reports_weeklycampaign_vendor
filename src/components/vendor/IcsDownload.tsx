'use client';

import { OpenEntry } from '@/lib/markdown-loader';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function icsDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

export default function IcsDownload({ open }: { open: OpenEntry }) {
  function handleClick() {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Grant Estate Agency//Vendor Portal//EN',
      'BEGIN:VEVENT',
      `UID:${open.id}@grantsea.com.au`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(open.start)}`,
      `DTEND:${icsDate(open.end)}`,
      `SUMMARY:Open Home${open.note ? ' — ' + open.note : ''}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `open-${open.id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleClick}
      className="font-body text-xs uppercase tracking-widest text-accent hover:underline whitespace-nowrap"
    >
      Add to calendar
    </button>
  );
}
