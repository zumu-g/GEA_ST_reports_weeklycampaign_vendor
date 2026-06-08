import Link from 'next/link';
import { listGuides } from '@/lib/guides';
import SectionHeading from '../SectionHeading';

// Surfaces a few GEA seller guides directly on the vendor dashboard, linking
// into the token-scoped guides section. Server component — reads guides at
// render time. Renders nothing when there are no published guides.
export default async function GuidesSpotlight({
  token,
  limit = 4,
}: {
  token: string;
  limit?: number;
}) {
  const guides = (await listGuides()).slice(0, limit);
  if (guides.length === 0) return null;

  return (
    <div className="mb-10">
      <SectionHeading label="Seller Guides" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {guides.map(g => (
          <Link
            key={g.slug}
            href={`/vendor/${token}/guides/${g.slug}`}
            className="block border border-border rounded-lg p-4 hover:border-accent transition-colors"
          >
            <p className="font-body text-[11px] uppercase tracking-wide text-muted mb-1">
              {g.category} · {g.read_time_min} min
            </p>
            <p className="font-body text-sm font-medium text-foreground">{g.title}</p>
            {g.summary && (
              <p className="font-body text-xs text-muted mt-1 line-clamp-2">{g.summary}</p>
            )}
          </Link>
        ))}
      </div>
      <Link
        href={`/vendor/${token}/guides`}
        className="inline-block font-body text-xs text-accent hover:underline mt-3"
      >
        View all guides →
      </Link>
    </div>
  );
}
