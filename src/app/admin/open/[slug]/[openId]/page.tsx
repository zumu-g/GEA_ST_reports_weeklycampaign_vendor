import { notFound } from 'next/navigation';
import { readOpens } from '@/lib/markdown-loader';
import CheckinPanel from '@/components/admin/CheckinPanel';

export default async function OpenCheckinPage({
  params,
}: {
  params: Promise<{ slug: string; openId: string }>;
}) {
  const { slug, openId } = await params;
  const opens = await readOpens(slug);
  const open = opens.find(o => o.id === openId);
  if (!open) notFound();

  return (
    <main>
      <CheckinPanel slug={slug} openId={openId} />
    </main>
  );
}
