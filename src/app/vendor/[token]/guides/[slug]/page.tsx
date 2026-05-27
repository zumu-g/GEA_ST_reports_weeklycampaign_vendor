import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPropertySlugForToken } from '@/lib/vendor-tokens';
import { getGuide, renderMarkdown } from '@/lib/guides';
import PrintButton from '@/components/vendor/PrintButton';

export default async function GuidePage({
  params,
}: { params: Promise<{ token: string; slug: string }> }) {
  const { token, slug: guideSlug } = await params;
  const propertySlug = getPropertySlugForToken(token);
  if (!propertySlug) notFound();

  const guide = await getGuide(guideSlug);
  if (!guide) notFound();

  const html = renderMarkdown(guide.body);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <Link
            href={`/vendor/${token}/guides`}
            className="font-body text-xs uppercase tracking-widest text-muted hover:text-foreground"
          >
            ← Resources
          </Link>
          <PrintButton />
        </div>

        <p className="font-body text-[10px] uppercase tracking-widest text-muted mb-3">
          {guide.category} · {guide.read_time_min} min read
        </p>

        <article
          className="guide-body font-body text-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <style>{`
          .guide-body h1 { font-family: var(--font-display, serif); font-size: 2rem; font-weight: 500; line-height: 1.2; margin-bottom: 1.5rem; }
          .guide-body h2 { font-family: var(--font-display, serif); font-size: 1.25rem; font-weight: 500; margin-top: 2rem; margin-bottom: 0.75rem; }
          .guide-body h3 { font-size: 1rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
          .guide-body p { font-size: 0.95rem; line-height: 1.7; margin-bottom: 1rem; }
          .guide-body ul { margin: 0.5rem 0 1rem 1.25rem; }
          .guide-body li { font-size: 0.95rem; line-height: 1.7; margin-bottom: 0.4rem; list-style: disc; }
          .guide-body strong { font-weight: 600; }
          .guide-body a { color: var(--accent, #b8860b); text-decoration: underline; }
          @media print {
            body { background: white; }
            .guide-body { color: black; }
          }
        `}</style>
      </div>
    </div>
  );
}
