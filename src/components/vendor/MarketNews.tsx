import SectionHeading from '@/components/SectionHeading';

interface NewsItem {
  title: string;
  url: string;
  summary: string;
}

interface MarketNewsProps {
  news: NewsItem[];
}

export default function MarketNews({ news }: MarketNewsProps) {
  if (news.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionHeading label="Market News" count={news.length} />
      <ul>
        {news.map((item, i) => (
          <li key={i}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="py-4 border-b border-border last:border-0 flex items-start gap-3 group transition-colors block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-foreground group-hover:text-accent transition-colors leading-snug mb-1">
                  {item.title}
                </p>
                <p className="font-body text-xs text-muted leading-relaxed">{item.summary}</p>
              </div>
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5 text-muted flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                fill="none"
                viewBox="0 0 14 14"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12L12 2M12 2H6M12 2v6" />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
