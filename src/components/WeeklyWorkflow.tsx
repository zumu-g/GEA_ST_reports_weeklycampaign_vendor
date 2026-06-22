import GenerateDraftsButton from "./GenerateDraftsButton";

/**
 * The dashboard's primary action: generate this week's drafts. Drafts now
 * pre-fill from the GEA CRM read API directly (resolve by address -> listings),
 * so there is no separate "sync listings" step — the data is pulled at generate
 * time. Fields the CRM can't supply come back flagged as gaps in each draft.
 */
export default function WeeklyWorkflow({ weekEnding }: { weekEnding: string }) {
  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <GenerateDraftsButton weekEnding={weekEnding} />
      <p className="font-body text-xs text-muted/70 min-h-[1rem]">
        Drafts pull the latest data from the CRM
      </p>
    </div>
  );
}
