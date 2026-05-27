import SectionHeading from '@/components/SectionHeading';

interface AppointmentCalendarProps {
  calendarId: string;
}

export default function AppointmentCalendar({ calendarId }: AppointmentCalendarProps) {
  if (!calendarId) return null;

  const src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=Australia%2FMelbourne&mode=AGENDA&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0`;
  const link = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarId)}`;

  return (
    <section className="mb-8">
      <SectionHeading label="Upcoming Appointments" />
      <div className="bg-card-bg rounded border border-border overflow-hidden">
        <iframe
          src={src}
          width="100%"
          height="400"
          frameBorder="0"
          scrolling="no"
          className="block w-full"
          title="Upcoming Appointments"
        />
      </div>
      <p className="font-body text-xs text-muted mt-2 text-right">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors duration-150"
        >
          Open in Google Calendar →
        </a>
      </p>
    </section>
  );
}
