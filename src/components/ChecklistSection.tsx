import SectionHeading from './SectionHeading';

interface ChecklistSectionProps {
  checklist: { task: string; done: boolean }[];
}

export default function ChecklistSection({ checklist }: ChecklistSectionProps) {
  const completed = checklist.filter((item) => item.done).length;
  const total = checklist.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-card-bg rounded border border-border p-6 mb-8">
      {/* Heading row */}
      <SectionHeading label="Campaign Checklist" count={`${completed}/${total}`} />

      {/* Progress bar */}
      <div className="w-full bg-surface rounded-full h-1 mb-6">
        <div
          className="h-1 rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor:
              percentage === 100
                ? "var(--color-success)"
                : "var(--color-accent)",
          }}
        />
      </div>

      {/* Checklist items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
        {checklist.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 md:[&:nth-last-child(-n+2)]:border-0"
          >
            {/* Circle checkbox */}
            {item.done ? (
              <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-2.5 h-2.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </span>
            ) : (
              <span className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0" />
            )}

            {/* Task text */}
            <span
              className={`font-body text-sm ${
                item.done
                  ? "text-muted line-through"
                  : "text-foreground"
              }`}
            >
              {item.task}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
