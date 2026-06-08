import AgentNotes from '@/components/admin/AgentNotes';
import AgentDocuments from '@/components/admin/AgentDocuments';

export default async function AdminPropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <AgentNotes slug={slug} />
      <AgentDocuments slug={slug} />
    </main>
  );
}
