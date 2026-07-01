"use client";

import { useState, useRef, RefObject } from "react";
import Link from "next/link";
import { GenerateReportInput, GeneratedReportNarrative, NewsArticle, WeeklyDraft } from "@/lib/types";
import SectionHeading from "@/components/SectionHeading";

// Keys in GenerateReportInput whose values are plain strings
type StringInputKey = {
  [K in keyof GenerateReportInput]: GenerateReportInput[K] extends string ? K : never;
}[keyof GenerateReportInput];

// ─── CSV stat parser ─────────────────────────────────────────────────────────

interface ParsedStats {
  views: number | null;
  enquiries: number | null;
  saves: number | null;
  searchAppearances: number | null;
}

function splitCSVRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of row) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === "," && !inQuotes) { cells.push(current.trim()); current = ""; continue; }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseNum(s: string): number | null {
  const n = parseInt(s.replace(/[,\s]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function parseCSVStats(text: string): ParsedStats {
  const rows = text.split(/\r?\n/).map((r) => splitCSVRow(r));
  // Find the first row with multiple non-empty cells (the header)
  const headerIdx = rows.findIndex((r) => r.filter(Boolean).length > 1);
  if (headerIdx === -1) return { views: null, enquiries: null, saves: null, searchAppearances: null };

  const headers = rows[headerIdx].map((h) => h.toLowerCase());

  const colOf = (pattern: RegExp) => {
    const idx = headers.findIndex((h) => pattern.test(h));
    return idx === -1 ? null : idx;
  };

  // Column matching — broad patterns to handle REA/Domain naming variations
  const viewsCol      = colOf(/^(?!.*search).*view/);
  const enquiriesCol  = colOf(/enquir/);
  const savesCol      = colOf(/save|shortlist|favourit/);
  const searchCol     = colOf(/search.*(appear|impress)/);

  const dataRows = rows.slice(headerIdx + 1).filter((r) => r.some(Boolean));
  if (dataRows.length === 0) return { views: null, enquiries: null, saves: null, searchAppearances: null };

  // Prefer a row explicitly labeled "Total" or "All time"; otherwise use last row
  const totalRow =
    dataRows.find((r) => /^total$|^all.?time$/i.test(r[0] ?? "")) ??
    dataRows[dataRows.length - 1];

  const pick = (col: number | null) => (col !== null ? parseNum(totalRow[col] ?? "") : null);

  return {
    views:             pick(viewsCol),
    enquiries:         pick(enquiriesCol),
    saves:             pick(savesCol),
    searchAppearances: pick(searchCol),
  };
}

// ─── Wizard state ───────────────────────────────────────────────────────────

const BLANK_STATE: GenerateReportInput = {
  propertyAddress: "",
  vendorName: "",
  agent: "",
  weekEnding: new Date().toISOString().split("T")[0],
  campaignType: "Auction",
  askingPrice: "",
  daysOnMarket: "",
  listingDate: "",
  reaViews: "",
  reaEnquiries: "",
  reaSaves: "",
  reaSearchAppearances: "",
  reaFileContent: "",
  reaViewsTarget: "",
  reaEnquiriesTarget: "",
  reaSavesTarget: "",
  domainViews: "",
  domainEnquiries: "",
  domainSaves: "",
  domainSearchAppearances: "",
  domainFileContent: "",
  domainViewsTarget: "",
  domainEnquiriesTarget: "",
  domainSavesTarget: "",
  openHomeAttendees: "",
  privateInspections: "",
  openHomeAttendeesTarget: "",
  inspectionNotes: "",
  agentCommentary: "",
  newsArticles: [],
};

const STEPS = [
  { num: 1, label: "Property" },
  { num: 2, label: "REA Stats" },
  { num: 3, label: "Domain Stats" },
  { num: 4, label: "Inspections" },
  { num: 5, label: "Commentary" },
  { num: 6, label: "News" },
  { num: 7, label: "Generate" },
];

// ─── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-start gap-0 mb-10 overflow-x-auto pb-2">
      {STEPS.map((step, idx) => (
        <div key={step.num} className="flex items-start min-w-fit">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                step.num < current
                  ? "bg-foreground/10 text-foreground"
                  : step.num === current
                  ? "bg-accent text-primary"
                  : "bg-surface text-muted border border-border"
              }`}
            >
              {step.num < current ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                step.num
              )}
            </div>
            <span
              className={`text-[10px] font-body font-medium whitespace-nowrap transition-colors ${
                step.num === current ? "text-foreground" : "text-muted"
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`h-px w-8 sm:w-10 mx-1 mt-3.5 transition-colors flex-shrink-0 ${
                step.num < current ? "bg-accent" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-body text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-lg border border-border bg-card-bg px-4 text-sm font-body text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
    />
  );
}

function StatBlock({
  portal,
  data,
  onUpdate,
  fileRef,
  onFileLoad,
}: {
  portal: "rea" | "domain";
  data: GenerateReportInput;
  onUpdate: (key: StringInputKey, val: string) => void;
  fileRef: RefObject<HTMLInputElement>;
  onFileLoad: (content: string) => void;
}) {
  const prefix = portal === "rea" ? "rea" : "domain";
  const name = portal === "rea" ? "realestate.com.au" : "domain.com.au";
  const dotColour = portal === "rea" ? "bg-red-500" : "bg-green-600";
  const [extracting, setExtracting] = useState(false);
  const [extractingLabel, setExtractingLabel] = useState("Extracting PDF…");
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);

  const parseAndFill = async (text: string) => {
    setExtractingLabel("Parsing stats…");
    setExtracting(true);
    try {
      const res = await fetch("/api/parse-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, portal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parse failed");

      const fields: [string, number | null][] = [
        [`${prefix}Views`, json.views],
        [`${prefix}Enquiries`, json.enquiries],
        [`${prefix}Saves`, json.saves],
        [`${prefix}SearchAppearances`, json.searchAppearances],
      ];
      let count = 0;
      for (const [key, val] of fields) {
        if (val !== null) {
          onUpdate(key as StringInputKey, String(val));
          count++;
        }
      }
      setParsedCount(count);
    } catch {
      setParsedCount(0);
    } finally {
      setExtracting(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setParsedCount(null);

    if (file.type === "application/pdf") {
      setExtractingLabel("Extracting PDF…");
      setExtracting(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/extract-pdf", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Extraction failed");
        onFileLoad(json.text);
        setExtracting(false);
        await parseAndFill(json.text);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Could not extract PDF text");
        setExtracting(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        onFileLoad(text);
        const result = parseCSVStats(text);
        const fields: [string, number | null][] = [
          [`${prefix}Views`, result.views],
          [`${prefix}Enquiries`, result.enquiries],
          [`${prefix}Saves`, result.saves],
          [`${prefix}SearchAppearances`, result.searchAppearances],
        ];
        let count = 0;
        for (const [key, val] of fields) {
          if (val !== null) {
            onUpdate(key as StringInputKey, String(val));
            count++;
          }
        }
        setParsedCount(count);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColour}`} />
          <h3 className="font-display text-lg font-medium text-foreground">{name}</h3>
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={extracting}
            className="font-body text-xs text-accent hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {extracting ? extractingLabel : "Upload report file (optional)"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv,.pdf"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>

      {fileError && (
        <div className="bg-danger/5 border border-danger/20 text-danger rounded-lg px-3 py-2 text-xs font-body font-medium">
          {fileError}
        </div>
      )}

      {!fileError && (data as unknown as Record<string, string>)[`${prefix}FileContent`] && parsedCount !== null && (
        <div className={`rounded-lg px-3 py-2 text-xs font-body font-medium ${
          parsedCount === 0
            ? "bg-warning/10 border border-warning/20 text-warning"
            : "bg-success/10 border border-success/20 text-success"
        }`}>
          {parsedCount === 0
            ? "File loaded but stats couldn't be extracted — please enter manually."
            : parsedCount === 4
            ? "4 stats extracted from file — review the fields above."
            : `${parsedCount} of 4 stats extracted — check and fill any missing fields.`}
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 mb-1">
          <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 col-start-2">Actual</span>
          <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60">Target</span>
        </div>
        {[
          { key: `${prefix}Views`, targetKey: `${prefix}ViewsTarget`, label: "Views" },
          { key: `${prefix}Enquiries`, targetKey: `${prefix}EnquiriesTarget`, label: "Enquiries" },
          { key: `${prefix}Saves`, targetKey: `${prefix}SavesTarget`, label: "Saves / Shortlists" },
          { key: `${prefix}SearchAppearances`, targetKey: null, label: "Search Appearances" },
        ].map(({ key, targetKey, label }) => (
          <div key={key} className="grid grid-cols-3 gap-2 items-center">
            <label className="font-body text-sm font-medium text-foreground">{label}</label>
            <input
              type="number"
              min="0"
              value={(data as unknown as Record<string, string>)[key]}
              onChange={(e) => onUpdate(key as StringInputKey, e.target.value)}
              placeholder="0"
              className="h-10 w-full rounded-lg border border-border bg-card-bg px-3 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
            {targetKey ? (
              <input
                type="number"
                min="0"
                value={(data as unknown as Record<string, string>)[targetKey]}
                onChange={(e) => onUpdate(targetKey as StringInputKey, e.target.value)}
                placeholder="—"
                className="h-10 w-full rounded-lg border border-dashed border-border bg-surface px-3 text-sm font-mono text-muted placeholder:text-muted/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            ) : (
              <div />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Narrative preview ───────────────────────────────────────────────────────

function NarrativePreview({
  narrative,
  input,
}: {
  narrative: GeneratedReportNarrative;
  input: GenerateReportInput;
}) {
  const [copied, setCopied] = useState(false);

  const statsLines = narrative.statsTable?.length
    ? [
        "",
        "STATS THIS WEEK",
        ...narrative.statsTable.map((r) => {
          const diff = r.target !== null && r.actual !== null ? r.actual - r.target : null;
          const pct = r.target && r.target > 0 ? Math.round((diff! / r.target) * 100) : null;
          return `${r.label}: ${r.actual}${r.target !== null ? ` (target ${r.target}${pct !== null ? `, ${pct >= 0 ? "+" : ""}${pct}%` : ""})` : ""}`;
        }),
      ]
    : [];

  const plainText = [
    narrative.greeting,
    "",
    narrative.openingParagraph,
    "",
    "KEY HIGHLIGHTS",
    ...narrative.performanceHighlights.map((h) => `• ${h}`),
    ...statsLines,
    "",
    "PORTAL PERFORMANCE",
    narrative.portalAnalysis,
    "",
    "INSPECTIONS",
    narrative.inspectionSummary,
    "",
    "MARKET CONTEXT",
    narrative.marketContext,
    "",
    "FROM YOUR AGENT",
    narrative.agentInsight,
    "",
    "LOOKING AHEAD",
    narrative.nextSteps,
    "",
    narrative.closing,
    "",
    `— ${input.agent}, Grants Estate Agents`,
  ].join("\n");

  const copyToClipboard = () => {
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-medium text-foreground">Report Generated</h3>
        <button
          onClick={copyToClipboard}
          className="font-body text-sm text-accent hover:underline"
        >
          {copied ? "Copied!" : "Copy as text"}
        </button>
      </div>

      <div className="bg-card-bg border border-border rounded p-7 space-y-5">
        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-1">Greeting</p>
          <p className="font-display text-base font-medium text-foreground leading-relaxed">{narrative.greeting}</p>
        </div>

        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-1">Opening</p>
          <p className="font-body text-sm text-foreground leading-relaxed">{narrative.openingParagraph}</p>
        </div>

        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-1">Key Highlights</p>
          <ul className="space-y-1.5 mt-1">
            {narrative.performanceHighlights.map((h, i) => (
              <li key={i} className="flex gap-2 font-body text-sm text-foreground leading-relaxed">
                <span className="text-accent font-bold mt-0.5 flex-shrink-0">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        {narrative.statsTable?.length > 0 && (
          <div>
            <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-2">Stats This Week</p>
            <table className="w-full text-sm font-body border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-4 font-medium text-muted text-xs">Metric</th>
                  <th className="text-right py-1.5 pr-4 font-medium text-muted text-xs">Actual</th>
                  <th className="text-right py-1.5 pr-4 font-medium text-muted text-xs">Target</th>
                  <th className="text-right py-1.5 font-medium text-muted text-xs">vs Target</th>
                </tr>
              </thead>
              <tbody>
                {narrative.statsTable.map((row) => {
                  const diff = row.actual !== null && row.target !== null ? row.actual - row.target : null;
                  const pct = diff !== null && row.target && row.target > 0 ? Math.round((diff / row.target) * 100) : null;
                  return (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-1.5 pr-4 text-foreground">{row.label}</td>
                      <td className="py-1.5 pr-4 text-right font-medium text-foreground">{row.actual !== null ? row.actual.toLocaleString() : "—"}</td>
                      <td className="py-1.5 pr-4 text-right text-muted">{row.target !== null ? row.target.toLocaleString() : "—"}</td>
                      <td className="py-1.5 text-right">
                        {pct !== null ? (
                          <span className={`font-medium ${pct >= 0 ? "text-success" : "text-danger"}`}>
                            {pct >= 0 ? "+" : ""}{pct}%
                          </span>
                        ) : (
                          <span className="text-muted/50">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-1">Portal Performance</p>
          <p className="font-body text-sm text-foreground leading-relaxed">{narrative.portalAnalysis}</p>
        </div>

        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-1">Inspections</p>
          <p className="font-body text-sm text-foreground leading-relaxed">{narrative.inspectionSummary}</p>
        </div>

        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-1">Market Context</p>
          <p className="font-body text-sm text-foreground leading-relaxed">{narrative.marketContext}</p>
        </div>

        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-1">From Your Agent</p>
          <p className="font-body text-sm text-foreground leading-relaxed">{narrative.agentInsight}</p>
        </div>

        <div>
          <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-1">Looking Ahead</p>
          <p className="font-body text-sm text-foreground leading-relaxed">{narrative.nextSteps}</p>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="font-body text-sm text-foreground leading-relaxed">{narrative.closing}</p>
          <p className="font-body text-sm text-muted font-medium mt-2">— {input.agent}, Grants Estate Agents</p>
        </div>
      </div>
    </div>
  );
}

// ─── Draft helpers ────────────────────────────────────────────────────────────

function draftToFormData(draft: WeeklyDraft): GenerateReportInput {
  return {
    ...BLANK_STATE,
    propertyAddress: draft.propertyAddress,
    vendorName: draft.vendorName,
    agent: draft.agent,
    weekEnding: draft.weekEnding,
    campaignType: draft.campaignType,
    askingPrice: draft.askingPrice,
    daysOnMarket: String(draft.daysOnMarket || ''),
    listingDate: draft.listingDate,
    reaViews: draft.reaViews > 0 ? String(draft.reaViews) : '',
    reaEnquiries: draft.reaEnquiries > 0 ? String(draft.reaEnquiries) : '',
    reaSaves: draft.reaSaves > 0 ? String(draft.reaSaves) : '',
    reaSearchAppearances: draft.reaSearchAppearances > 0 ? String(draft.reaSearchAppearances) : '',
    domainViews: draft.domainViews > 0 ? String(draft.domainViews) : '',
    domainEnquiries: draft.domainEnquiries > 0 ? String(draft.domainEnquiries) : '',
    domainSaves: draft.domainSaves > 0 ? String(draft.domainSaves) : '',
    domainSearchAppearances: draft.domainSearchAppearances > 0 ? String(draft.domainSearchAppearances) : '',
    openHomeAttendees: draft.openHomeAttendees > 0 ? String(draft.openHomeAttendees) : '',
    privateInspections: draft.privateInspections > 0 ? String(draft.privateInspections) : '',
    agentCommentary: draft.agentCommentary,
    newsArticles: draft.newsArticles,
  };
}

// ─── Main wizard ─────────────────────────────────────────────────────────────

export default function ReportWizard({
  activeListings,
  initialDraft,
  draftId,
}: {
  activeListings: { id: string; address: string; vendor: string; agent: string }[];
  initialDraft?: WeeklyDraft;
  draftId?: string;
}) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<GenerateReportInput>(
    initialDraft ? draftToFormData(initialDraft) : BLANK_STATE
  );
  const [narrative, setNarrative] = useState<GeneratedReportNarrative | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftingCommentary, setDraftingCommentary] = useState(false);
  const [draftingNews, setDraftingNews] = useState(false);

  const reaFileRef = useRef<HTMLInputElement>(null) as RefObject<HTMLInputElement>;
  const domainFileRef = useRef<HTMLInputElement>(null) as RefObject<HTMLInputElement>;

  const set = (key: StringInputKey, val: string) =>
    setData((d) => ({ ...d, [key]: val }));

  const prefillFromListing = (id: string) => {
    const listing = activeListings.find((l) => l.id === id);
    if (!listing) return;
    setData((d) => ({
      ...d,
      propertyAddress: listing.address,
      vendorName: listing.vendor,
      agent: listing.agent,
    }));
  };

  const draftCommentary = async () => {
    setDraftingCommentary(true);
    try {
      const res = await fetch("/api/draft-commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Draft failed");
      set("agentCommentary", json.commentary);
    } catch (e) {
      console.error(e);
    } finally {
      setDraftingCommentary(false);
    }
  };

  const draftMarketNews = async () => {
    setDraftingNews(true);
    try {
      const res = await fetch("/api/draft-market-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyAddress: data.propertyAddress, weekEnding: data.weekEnding }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Draft failed");
      const articles = (json.articles as { title: string; url?: string; note: string }[]).map((a) => ({
        id: crypto.randomUUID(),
        title: a.title,
        url: a.url ?? "",
        note: a.note,
      }));
      setData((d) => ({ ...d, newsArticles: [...d.newsArticles, ...articles] }));
    } catch (e) {
      console.error(e);
    } finally {
      setDraftingNews(false);
    }
  };

  const addNewsArticle = () =>
    setData((d) => ({
      ...d,
      newsArticles: [
        ...d.newsArticles,
        { id: crypto.randomUUID(), title: "", url: "", note: "" },
      ],
    }));

  const updateNewsArticle = (id: string, key: keyof NewsArticle, val: string) =>
    setData((d) => ({
      ...d,
      newsArticles: d.newsArticles.map((a) => (a.id === id ? { ...a, [key]: val } : a)),
    }));

  const removeNewsArticle = (id: string) =>
    setData((d) => ({
      ...d,
      newsArticles: d.newsArticles.filter((a) => a.id !== id),
    }));

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Generation failed");
      const result: GeneratedReportNarrative = json.narrative;
      setNarrative(result);

      // If editing a draft, save the updated stats and narrative back to it
      if (draftId) {
        await fetch(`/api/weekly-drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reaViews: parseInt(data.reaViews) || 0,
            reaEnquiries: parseInt(data.reaEnquiries) || 0,
            reaSaves: parseInt(data.reaSaves) || 0,
            reaSearchAppearances: parseInt(data.reaSearchAppearances) || 0,
            domainViews: parseInt(data.domainViews) || 0,
            domainEnquiries: parseInt(data.domainEnquiries) || 0,
            domainSaves: parseInt(data.domainSaves) || 0,
            domainSearchAppearances: parseInt(data.domainSearchAppearances) || 0,
            openHomeAttendees: parseInt(data.openHomeAttendees) || 0,
            privateInspections: parseInt(data.privateInspections) || 0,
            agentCommentary: data.agentCommentary,
            newsArticles: data.newsArticles,
            generatedNarrative: result,
          }),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const canNext = () => {
    if (step === 1) return data.propertyAddress.trim() && data.vendorName.trim() && data.agent.trim() && data.weekEnding;
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator current={step} />

      <div className="bg-card-bg rounded border border-border p-8">

        {/* ── Step 1: Property ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <SectionHeading label="Property Details" />
              <p className="font-body text-sm text-muted -mt-3 mb-6">Select an active listing or enter details for a new property.</p>
            </div>

            {activeListings.length > 0 && (
              <FieldRow label="Quick select">
                <select
                  className="h-11 w-full rounded-lg border border-border bg-card-bg px-4 text-sm font-body text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  onChange={(e) => prefillFromListing(e.target.value)}
                  defaultValue=""
                >
                  <option value="">— Pick a listing to pre-fill —</option>
                  {activeListings.map((l) => (
                    <option key={l.id} value={l.id}>{l.address}</option>
                  ))}
                </select>
              </FieldRow>
            )}

            <div className="border-t border-border pt-5 space-y-4">
              <FieldRow label="Property address *">
                <Input value={data.propertyAddress} onChange={(v) => set("propertyAddress", v)} placeholder="42 Oceanview Drive, Brighton VIC 3186" />
              </FieldRow>
              <FieldRow label="Vendor name(s) *">
                <Input value={data.vendorName} onChange={(v) => set("vendorName", v)} placeholder="John & Sarah Mitchell" />
              </FieldRow>
              <FieldRow label="Agent *">
                <Input value={data.agent} onChange={(v) => set("agent", v)} placeholder="Stuart Grant" />
              </FieldRow>
              <FieldRow label="Week ending *">
                <Input value={data.weekEnding} onChange={(v) => set("weekEnding", v)} type="date" />
              </FieldRow>
              <FieldRow label="Listed date">
                <Input value={data.listingDate} onChange={(v) => set("listingDate", v)} type="date" />
              </FieldRow>
              <FieldRow label="Days on market">
                <Input value={data.daysOnMarket} onChange={(v) => set("daysOnMarket", v)} type="number" placeholder="28" />
              </FieldRow>
              <FieldRow label="Campaign type">
                <select
                  value={data.campaignType}
                  onChange={(e) => set("campaignType", e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-card-bg px-4 text-sm font-body text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                >
                  <option>Auction</option>
                  <option>Private Sale</option>
                  <option>Expressions of Interest</option>
                  <option>Off-market</option>
                </select>
              </FieldRow>
              <FieldRow label="Asking price">
                <Input value={data.askingPrice} onChange={(v) => set("askingPrice", v)} placeholder="$1,850,000 – $2,035,000" />
              </FieldRow>
            </div>
          </div>
        )}

        {/* ── Step 2: REA ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <SectionHeading label="realestate.com.au Stats" />
              <p className="font-body text-sm text-muted -mt-3 mb-6">Enter this week&apos;s stats from REA. Optionally upload your CSV export and Claude will extract the numbers.</p>
            </div>
            <StatBlock
              portal="rea"
              data={data}
              onUpdate={set}
              fileRef={reaFileRef}
              onFileLoad={(content) => set("reaFileContent", content)}
            />
          </div>
        )}

        {/* ── Step 3: Domain ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <SectionHeading label="domain.com.au Stats" />
              <p className="font-body text-sm text-muted -mt-3 mb-6">Enter this week&apos;s stats from Domain. Optionally upload your CSV export.</p>
            </div>
            <StatBlock
              portal="domain"
              data={data}
              onUpdate={set}
              fileRef={domainFileRef}
              onFileLoad={(content) => set("domainFileContent", content)}
            />
          </div>
        )}

        {/* ── Step 4: Inspections ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <SectionHeading label="Inspections This Week" />
              <p className="font-body text-sm text-muted -mt-3 mb-6">How many people came through the property?</p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 mb-1">
                <span />
                <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60">Actual</span>
                <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60">Target</span>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="font-body text-sm font-medium text-foreground">Open Home</label>
                <input
                  type="number"
                  min="0"
                  value={data.openHomeAttendees}
                  onChange={(e) => set("openHomeAttendees", e.target.value)}
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-border bg-card-bg px-3 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <input
                  type="number"
                  min="0"
                  value={data.openHomeAttendeesTarget}
                  onChange={(e) => set("openHomeAttendeesTarget", e.target.value)}
                  placeholder="—"
                  className="h-10 w-full rounded-lg border border-dashed border-border bg-surface px-3 text-sm font-mono text-muted placeholder:text-muted/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="font-body text-sm font-medium text-foreground">Private Insp.</label>
                <input
                  type="number"
                  min="0"
                  value={data.privateInspections}
                  onChange={(e) => set("privateInspections", e.target.value)}
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-border bg-card-bg px-3 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <div />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-body text-sm font-medium text-foreground">
                Inspection Notes <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea
                value={data.inspectionNotes}
                onChange={(e) => set("inspectionNotes", e.target.value)}
                placeholder="e.g. Strong interest from 3 buyers, 2 asked for contracts..."
                rows={3}
                className="w-full rounded-md border border-border bg-card-bg px-4 py-3 text-sm font-body text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
              />
            </div>
          </div>
        )}

        {/* ── Step 5: Commentary ── */}
        {step === 5 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionHeading label="Agent's Weekly Commentary" />
                <p className="font-body text-sm text-muted mt-1">Write your notes for this week. AI will rewrite these into professional vendor-facing language — so be as raw and direct as you like.</p>
              </div>
              <button
                type="button"
                onClick={draftCommentary}
                disabled={draftingCommentary}
                className="flex-shrink-0 h-9 rounded-md px-4 font-body text-xs font-medium bg-surface border border-border text-foreground hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-wait transition-all whitespace-nowrap"
              >
                {draftingCommentary ? "Drafting…" : "✦ AI Draft"}
              </button>
            </div>
            <textarea
              value={data.agentCommentary}
              onChange={(e) => set("agentCommentary", e.target.value)}
              placeholder="e.g. Great open home, 24 groups, 3 really serious buyers. Couple from Malvern seemed very keen — inspected twice. Got 2 enquiries from interstate investors. Comparable at 38 Smith St sold under the hammer at $2.1m on Saturday which is a good sign for our price guide..."
              rows={10}
              className="w-full rounded-md border border-border bg-card-bg px-4 py-3 text-sm font-body text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
            />
          </div>
        )}

        {/* ── Step 6: News ── */}
        {step === 6 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionHeading label="Market News (optional)" />
                <p className="font-body text-sm text-muted mt-1">Add relevant news to give the vendor market context. AI can draft Casey &amp; Cardinia talking points — add source URLs where you have them.</p>
              </div>
              <button
                type="button"
                onClick={draftMarketNews}
                disabled={draftingNews}
                className="flex-shrink-0 h-9 rounded-md px-4 font-body text-xs font-medium bg-surface border border-border text-foreground hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-wait transition-all whitespace-nowrap"
              >
                {draftingNews ? "Drafting…" : "✦ AI Draft News"}
              </button>
            </div>

            {data.newsArticles.length === 0 && (
              <div className="bg-surface rounded-md border border-border p-4 text-center font-body text-sm text-muted">
                No articles added yet — skip this step or add some below.
              </div>
            )}

            <div className="space-y-4">
              {data.newsArticles.map((article) => (
                <div key={article.id} className="bg-surface rounded-md border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted/60">Article</span>
                    <button
                      onClick={() => removeNewsArticle(article.id)}
                      className="font-body text-xs text-danger hover:text-danger/70 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={article.title}
                    onChange={(e) => updateNewsArticle(article.id, "title", e.target.value)}
                    placeholder="Article headline"
                    className="h-11 w-full rounded-lg border border-border bg-card-bg px-4 text-sm font-body text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                  <input
                    type="url"
                    value={article.url}
                    onChange={(e) => updateNewsArticle(article.id, "url", e.target.value)}
                    placeholder="https://..."
                    className="h-11 w-full rounded-lg border border-border bg-card-bg px-4 text-sm font-body text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                  <input
                    type="text"
                    value={article.note}
                    onChange={(e) => updateNewsArticle(article.id, "note", e.target.value)}
                    placeholder="Why is this relevant? (optional)"
                    className="h-11 w-full rounded-lg border border-border bg-card-bg px-4 text-sm font-body text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                </div>
              ))}
            </div>

            {data.newsArticles.length < 5 && (
              <button
                onClick={addNewsArticle}
                className="w-full rounded-md border border-dashed border-border py-3 font-body text-sm text-muted hover:border-accent hover:text-accent transition-colors"
              >
                + Add article
              </button>
            )}
          </div>
        )}

        {/* ── Step 7: Generate ── */}
        {step === 7 && (
          <div className="space-y-6">
            {!narrative && !generating && (
              <div className="space-y-5">
                <div>
                  <SectionHeading label="Ready to Generate" />
                  <p className="font-body text-sm text-muted -mt-3 mb-6">Claude will read everything you&apos;ve provided and write a professional vendor report narrative.</p>
                </div>

                <div className="bg-surface rounded-md border border-border p-5 space-y-2">
                  {[
                    { label: "Property", value: data.propertyAddress || "—" },
                    { label: "Vendor", value: data.vendorName || "—" },
                    { label: "Week ending", value: data.weekEnding || "—" },
                    {
                      label: "Portal views",
                      value: `REA ${data.reaViews || "—"} · Domain ${data.domainViews || "—"}`,
                    },
                    {
                      label: "Inspections",
                      value: `${data.openHomeAttendees || "0"} open home + ${data.privateInspections || "0"} private`,
                    },
                    {
                      label: "Commentary",
                      value: data.agentCommentary
                        ? `${data.agentCommentary.slice(0, 80)}…`
                        : "none",
                    },
                    { label: "News articles", value: String(data.newsArticles.length) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-2 font-body text-sm">
                      <span className="text-muted w-28 flex-shrink-0">{label}</span>
                      <span className="text-foreground font-medium">{value}</span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="bg-danger/5 border border-danger/20 rounded-md px-4 py-3 font-body text-sm text-danger">
                    {error}
                  </div>
                )}

                <button
                  onClick={generate}
                  className="w-full h-11 rounded-md px-6 font-body font-medium text-sm bg-accent text-primary hover:bg-accent-light transition-all"
                >
                  Generate Report with AI
                </button>
              </div>
            )}

            {generating && (
              <div className="py-12 flex flex-col items-center gap-4 text-center">
                <div className="w-10 h-10 border-[3px] border-border border-t-accent rounded-full animate-spin" />
                <p className="font-display text-xl font-medium text-foreground">Claude is writing your report…</p>
                <p className="font-body text-sm text-muted">This usually takes 10–20 seconds</p>
              </div>
            )}

            {narrative && !generating && (
              <div className="space-y-5">
                <NarrativePreview narrative={narrative} input={data} />
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setNarrative(null); setError(null); }}
                    className="flex-1 h-11 rounded-md px-6 font-body font-medium text-sm bg-surface text-foreground border border-border hover:bg-border transition-all"
                  >
                    Regenerate
                  </button>
                  {draftId ? (
                    <Link
                      href={`/report/${draftId}`}
                      className="flex-1 h-11 rounded-md px-6 font-body font-medium text-sm bg-accent text-primary hover:bg-accent/80 transition-all flex items-center justify-center"
                    >
                      View Report
                    </Link>
                  ) : (
                    <button
                      onClick={() => {
                        setStep(1);
                        setData(BLANK_STATE);
                        setNarrative(null);
                        setError(null);
                      }}
                      className="flex-1 h-11 rounded-md px-6 font-body font-medium text-sm bg-accent text-primary hover:bg-accent-light transition-all"
                    >
                      New Report
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        {!(step === 7 && (generating || narrative)) && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="h-11 rounded-md px-6 font-body font-medium text-sm bg-surface text-foreground border border-border hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Back
            </button>

            {step < 7 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="h-11 rounded-md px-6 font-body font-medium text-sm bg-accent text-primary hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={generate}
                disabled={generating}
                className="h-11 rounded-md px-6 font-body font-medium text-sm bg-accent text-primary hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Generate Report
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
