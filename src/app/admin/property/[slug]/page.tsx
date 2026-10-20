import Link from 'next/link';
import AgentNotes from '@/components/admin/AgentNotes';
import AgentDocuments from '@/components/admin/AgentDocuments';
import AgentOffers from '@/components/admin/AgentOffers';
import { readOpens } from '@/lib/markdown-loader';

export default async function AdminPropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const opens = await readOpens(slug);
  const todayOpens = opens.filter(o => o.start.slice(0, 10) === new Date().toISOString().slice(0, 10));

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      {todayOpens.length > 0 && (
        <section className="mb-6">
          <p className="text-sm font-medium text-muted mb-2">Today&apos;s opens</p>
          <ul className="space-y-1">
            {todayOpens.map(o => (
              <li key={o.id}>
                <Link href={`/admin/open/${slug}/${o.id}`} className="underline">
                  {new Date(o.start).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} — check in
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <AgentOffers slug={slug} />
      <AgentNotes slug={slug} />
      <AgentDocuments slug={slug} />
    </main>
  );
}
