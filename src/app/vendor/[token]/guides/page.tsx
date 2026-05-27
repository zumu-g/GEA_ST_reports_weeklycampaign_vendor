import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPropertySlugForToken } from '@/lib/vendor-tokens';
import { listGuides } from '@/lib/guides';

export default async function GuidesIndex({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const slug = getPropertySlugForToken(token);
  if (!slug) notFound();

  const guides = await listGuides();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link
          href={`/vendor/${token}`}
          className="font-body text-xs uppercase tracking-widest text-muted hover:text-foreground"
        >
          ← Dashboard
        </Link>
        <h1 className="font-display text-3xl font-medium text-foreground mt-6 mb-2">Resources</h1>
        <p className="font-body text-sm text-muted mb-8">
          Short guides covering the things vendors most often ask us about.
        </p>

        <ul className="space-y-3">
          {guides.map(g => (
            <li key={g.slug}>
              <Link
                href={`/vendor/${token}/guides/${g.slug}`}
                className="block bg-card-bg border border-border rounded p-5 hover:border-accent transition-colors"
              >
                <p className="font-body text-[10px] uppercase tracking-widest text-muted mb-2">
                  {g.category} · {g.read_time_min} min read
                </p>
                <p className="font-display text-lg font-medium text-foreground mb-1">{g.title}</p>
                <p className="font-body text-sm text-muted">{g.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
