/**
 * Weekly campaign update report generator (vendor / owner communications).
 *
 * Parameterised pipeline:
 *   inputs (week number, portal PDFs/stats, open-home figures, agent comments)
 *     -> formatted owner-facing report (Markdown) + delivery-ready email draft
 *
 * Generation only — nothing is sent. The email draft is written to disk and a
 * send step is stubbed (and intentionally not wired) for an approval workflow.
 *
 * Run:
 *   node scripts/weekly-report/generate.mjs <input.json> [--out <dir>]
 *
 * Matches the GEA report structure/tone established in
 * src/app/api/generate-report/route.ts (no standalone letter template exists
 * in the repo; that narrative shape + the warm "trusted advisor" voice is the
 * de-facto template).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePortalStats } from "./parse-portal.mjs";
import { buildNarrative, weekFocus } from "./narrative.mjs";
import { buildChecklist } from "./checklist.mjs";
import { buildAlerts } from "./alerts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ----------------------------- context build ----------------------------- */

function sumNullable(a, b) {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

async function buildContext(input) {
  const rea = await resolvePortalStats(input.portals?.rea, "rea");
  const domain = await resolvePortalStats(input.portals?.domain, "domain");

  const missingPortals = [];
  if (!rea) missingPortals.push("rea");
  if (!domain) missingPortals.push("domain");

  const totals = {
    views: sumNullable(rea?.views, domain?.views),
    enquiries: sumNullable(rea?.enquiries, domain?.enquiries),
    saves: sumNullable(rea?.saves, domain?.saves),
    reveals: sumNullable(rea?.reveals, domain?.reveals),
  };

  // Week-on-week deltas from the previous week's totals supplied in input.
  const prev = input.previousWeek ?? {};
  const deltas = {
    views: totals.views != null && prev.views != null ? totals.views - prev.views : null,
    enquiries:
      totals.enquiries != null && prev.enquiries != null ? totals.enquiries - prev.enquiries : null,
  };

  const openHome = {
    attendees: input.openHome?.groups ?? input.openHome?.attendees ?? 0,
    groups: input.openHome?.groups ?? 0,
    names: input.openHome?.names ?? [],
    previousAttendees: input.openHome?.previousGroups ?? input.openHome?.previousAttendees ?? null,
    privateInspections: input.openHome?.privateInspections ?? 0,
  };

  return {
    input,
    week: input.week,
    propertyAddress: input.propertyAddress,
    vendorName: input.vendorName,
    agent: input.agent,
    weekEnding: input.weekEnding,
    askingPrice: input.askingPrice,
    rea,
    domain,
    missingPortals,
    totals,
    deltas,
    openHome,
  };
}

/* ------------------------------- rendering -------------------------------- */

function fmt(n) {
  return n == null ? "—" : n.toLocaleString();
}

function deltaSuffix(d) {
  if (d == null) return "";
  if (d > 0) return ` (▲ +${d.toLocaleString()})`;
  if (d < 0) return ` (▼ ${d.toLocaleString()})`;
  return " (no change)";
}

function renderPortalRow(label, stat) {
  if (!stat) return `| ${label} | _no report received_ | — | — | — |`;
  return `| ${label} | ${fmt(stat.views)} | ${fmt(stat.enquiries)} | ${fmt(stat.saves)} | ${fmt(stat.reveals)} |`;
}

function renderChecklistTable(checklist) {
  const tick = (d) => (d ? "✅ Done" : "⬜ Outstanding");
  const rows = Math.max(checklist.weDo.length, checklist.youDo.length);
  let out = "| We Do (agency) | | You Do (owner) | |\n|---|---|---|---|\n";
  for (let i = 0; i < rows; i++) {
    const we = checklist.weDo[i];
    const you = checklist.youDo[i];
    out += `| ${we ? we.label : ""} | ${we ? tick(we.done) : ""} | ${you ? you.label : ""} | ${you ? tick(you.done) : ""} |\n`;
  }
  return out;
}

export function renderReport(ctx) {
  const n = buildNarrative(ctx);
  const checklist = buildChecklist(ctx);
  const alerts = buildAlerts(ctx);
  const { totals, deltas, rea, domain, openHome } = ctx;

  const lines = [];
  lines.push(`# Grants Estate Agents — Weekly Campaign Update`);
  lines.push("");
  lines.push(`**${ctx.propertyAddress}**`);
  lines.push("");
  lines.push(
    `Week ${ctx.week} · ${weekFocus(ctx.week)} · Week ending ${ctx.weekEnding}  `
  );
  lines.push(`Prepared for ${ctx.vendorName} by ${ctx.agent}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Greeting + opening
  lines.push(`Dear ${ctx.vendorName},`);
  lines.push("");
  lines.push(n.opening);
  lines.push("");

  // Performance snapshot
  lines.push(`## This week at a glance`);
  lines.push("");
  lines.push(`- **Total views:** ${fmt(totals.views)}${deltaSuffix(deltas.views)}`);
  lines.push(`- **Enquiries:** ${fmt(totals.enquiries)}${deltaSuffix(deltas.enquiries)}`);
  lines.push(`- **Saves / shortlists:** ${fmt(totals.saves)}`);
  lines.push(`- **Open-home groups through:** ${openHome.groups}`);
  if (openHome.privateInspections)
    lines.push(`- **Private inspections:** ${openHome.privateInspections}`);
  lines.push("");

  // Portal breakdown table
  lines.push(`## Online performance by portal`);
  lines.push("");
  lines.push(`| Portal | Views | Enquiries | Saves | Reveals |`);
  lines.push(`|---|---|---|---|---|`);
  lines.push(renderPortalRow("realestate.com.au", rea));
  lines.push(renderPortalRow("Domain", domain));
  lines.push(`| **Combined** | **${fmt(totals.views)}** | **${fmt(totals.enquiries)}** | **${fmt(totals.saves)}** | **${fmt(totals.reveals)}** |`);
  lines.push("");
  const comparison = rea?.comparison || domain?.comparison;
  if (comparison) {
    lines.push(`> _Comparison to similar listings:_ ${comparison}`);
    lines.push("");
  }

  // Week focus narrative
  lines.push(`## ${weekFocus(ctx.week)}`);
  lines.push("");
  for (const point of n.focus) lines.push(`- ${point}`);
  lines.push("");
  if (n.recommendation) {
    lines.push(`### Our recommendation`);
    lines.push("");
    lines.push(n.recommendation);
    lines.push("");
  }
  lines.push(`_${n.whatToExpect}_`);
  lines.push("");

  // Open-home detail
  if (openHome.names.length) {
    lines.push(`## Open-home attendance`);
    lines.push("");
    lines.push(`${openHome.groups} group(s) attended. Buyers captured:`);
    lines.push("");
    for (const name of openHome.names) lines.push(`- ${name}`);
    lines.push("");
  }

  // We Do / You Do checklist
  lines.push(`## Campaign checklist`);
  lines.push("");
  lines.push(renderChecklistTable(checklist));

  // Agent comment
  lines.push(`## A note from ${ctx.agent}`);
  lines.push("");
  lines.push(ctx.input.agentComment?.trim() || "_(No additional note this week.)_");
  lines.push("");

  // Closing
  lines.push("---");
  lines.push("");
  lines.push(
    `As always, please reach out any time with questions — we're here to guide you through every week of the campaign.`
  );
  lines.push("");
  lines.push(`Warm regards,  `);
  lines.push(`${ctx.agent}  `);
  lines.push(`Grants Estate Agents`);
  lines.push("");

  // Internal alerts section (agent-facing, kept clearly separated)
  if (alerts.length) {
    lines.push("---");
    lines.push("");
    lines.push(`<!-- INTERNAL — review before sending; not for the owner -->`);
    lines.push(`### ⚠️ Internal alerts (${alerts.length})`);
    lines.push("");
    for (const a of alerts) lines.push(`- **[${a.level}] ${a.code}** — ${a.message}`);
    lines.push("");
  }

  return { markdown: lines.join("\n"), alerts, checklist };
}

/* --------------------------- email draft (stub) --------------------------- */

function renderEmailDraft(ctx, reportPath) {
  return [
    `To: ${ctx.input.vendorEmail ?? "<vendor email>"}`,
    `From: ${ctx.agent} <agent@grantsestateagents.com.au>`,
    `Subject: Your weekly campaign update — ${ctx.propertyAddress} (Week ${ctx.week})`,
    ``,
    `Hi ${ctx.vendorName},`,
    ``,
    `Your week ${ctx.week} campaign update for ${ctx.propertyAddress} is ready.`,
    `Please find the full report attached / linked below.`,
    ``,
    `Attachment: ${path.basename(reportPath)}`,
    ``,
    `Warm regards,`,
    `${ctx.agent}`,
    `Grants Estate Agents`,
    ``,
    `--`,
    `[STUB] Delivery is intentionally not wired. To send, an approval step`,
    `would hand this draft to the configured provider (e.g. Resend). Nothing`,
    `is sent by this generator.`,
  ].join("\n");
}

/* --------------------------------- main ----------------------------------- */

export async function generate(input) {
  // Minimal validation
  for (const f of ["week", "propertyAddress", "vendorName", "agent", "weekEnding"]) {
    if (input[f] === undefined || input[f] === null || input[f] === "")
      throw new Error(`Missing required input field: "${f}"`);
  }
  const ctx = await buildContext(input);
  const { markdown, alerts, checklist } = renderReport(ctx);
  return { ctx, markdown, alerts, checklist, renderEmailDraft };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) {
    console.log("Usage: node scripts/weekly-report/generate.mjs <input.json> [--out <dir>]");
    process.exit(args.length ? 0 : 1);
  }
  const inputPath = args[0];
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join(__dirname, "output");

  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const { ctx, markdown, alerts } = await generate(input);

  fs.mkdirSync(outDir, { recursive: true });
  const slug = ctx.propertyAddress.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const base = `${slug}-week-${ctx.week}`;
  const reportPath = path.join(outDir, `${base}.md`);
  const emailPath = path.join(outDir, `${base}.email.txt`);

  fs.writeFileSync(reportPath, markdown, "utf8");
  fs.writeFileSync(emailPath, renderEmailDraft(ctx, reportPath), "utf8");

  console.log(`✓ Report written:      ${reportPath}`);
  console.log(`✓ Email draft (stub):  ${emailPath}  [NOT sent]`);
  if (ctx.missingPortals.length)
    console.log(`  Missing portal reports: ${ctx.missingPortals.join(", ")}`);
  console.log(`  Alerts flagged: ${alerts.length}`);
  for (const a of alerts) console.log(`    - [${a.level}] ${a.message}`);
}

// Run as CLI when invoked directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error("✗ Generation failed:", err.message);
    process.exit(1);
  });
}
