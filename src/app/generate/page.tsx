import Header from "@/components/Header";
import ReportWizard from "@/components/ReportWizard";
import { getLivePropertyData } from "@/lib/live-properties";
import { getWeeklyDraft, parseWeeklyDraftId } from "@/lib/weekly-drafts";
import { mockReports } from "@/lib/mock-data";
import { WeeklyDraft } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ draftId?: string }>;
}

export default async function GeneratePage({ searchParams }: PageProps) {
  const { draftId } = await searchParams;
  const { properties } = await getLivePropertyData();

  // Build a list of active listings for the quick-select dropdown
  const fromMarkdown = properties.map((p) => ({
    id: p.slug,
    address: p.address,
    vendor: p.owner,
    agent: p.agent,
  }));

  const fromMock = mockReports.map((r) => ({
    id: r.id,
    address: r.propertyAddress,
    vendor: r.vendorName,
    agent: r.agent,
  }));

  const activeListings = fromMarkdown.length > 0 ? fromMarkdown : fromMock;

  // Load existing draft if editing
  let initialDraft: WeeklyDraft | undefined;
  if (draftId) {
    const parsed = parseWeeklyDraftId(draftId);
    if (parsed) {
      const draft = await getWeeklyDraft(parsed.slug, parsed.weekEnding);
      if (draft) initialDraft = draft;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">
            {initialDraft ? "Edit Draft Report" : "Generate Weekly Report"}
          </h2>
          <p className="text-muted text-sm mt-1">
            {initialDraft
              ? `Editing draft for ${initialDraft.propertyAddress} — week ending ${initialDraft.weekEnding}.`
              : "Walk through each step to compile this week's data, then AI writes the full vendor report."}
          </p>
        </div>

        <ReportWizard
          activeListings={activeListings}
          initialDraft={initialDraft}
          draftId={draftId}
        />
      </main>

      <footer className="border-t border-border mt-16 py-6 text-center text-sm text-muted">
        Grants Estate Agents &middot; Weekly Campaign &amp; Vendor Reports
      </footer>
    </div>
  );
}
