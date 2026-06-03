/**
 * Portal report parsing — extract online stats from realestate.com.au / Domain
 * PDF exports (or pre-extracted text).
 *
 * Handles a missing PDF for a portal gracefully: returns null and the caller
 * raises a "no portal PDF received" alert.
 */
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);

/** Find the first integer following a label (case-insensitive). */
function findNumber(text, labels) {
  for (const label of labels) {
    // label ... <number with optional thousands separators>
    const re = new RegExp(
      label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "[^0-9\\n]{0,40}?([0-9][0-9,\\.]*)",
      "i"
    );
    const m = text.match(re);
    if (m) return parseInt(m[1].replace(/[,\.]/g, ""), 10);
  }
  return null;
}

/** Try to capture "X% more/fewer than similar" style ranking/comparison text. */
function findComparison(text) {
  const m = text.match(
    /([0-9]+(?:\.[0-9]+)?\s*(?:%|x|times)[^\n.]{0,60}(?:similar|comparable|average|other)[^\n.]{0,40})/i
  );
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

/**
 * Extract stats from already-extracted portal text.
 * @param {string} text
 * @param {"rea"|"domain"} portal
 */
export function extractStatsFromText(text, portal) {
  if (!text || typeof text !== "string") return null;

  const viewsLabels =
    portal === "domain"
      ? ["Property views", "Listing views", "Views"]
      : ["Listing views", "Views"];
  const enquiriesLabels =
    portal === "domain"
      ? ["Email enquiries", "Enquiries"]
      : ["Enquiries", "Email enquiries"];
  const savesLabels =
    portal === "domain"
      ? ["Saves", "Saved", "Shortlisted"]
      : ["Shortlisted", "Saves", "Saved"];
  const revealLabels = ["Phone reveals", "Phone number reveals", "Email reveals", "Contact reveals"];
  const searchLabels = ["Search impressions", "Search appearances", "Appearances in search"];

  return {
    portal,
    views: findNumber(text, viewsLabels),
    enquiries: findNumber(text, enquiriesLabels),
    saves: findNumber(text, savesLabels),
    reveals: findNumber(text, revealLabels),
    searchAppearances: findNumber(text, searchLabels),
    comparison: findComparison(text),
  };
}

/**
 * Extract text from a PDF file using pdf-parse, then parse stats.
 * Returns null if the file is missing/unreadable (missing-PDF case).
 * @param {string} pdfPath
 * @param {"rea"|"domain"} portal
 */
export async function extractStatsFromPdf(pdfPath, portal) {
  if (!pdfPath || !fs.existsSync(pdfPath)) return null;
  try {
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(buffer);
    return extractStatsFromText(data.text, portal);
  } catch {
    return null;
  }
}

/**
 * Resolve a portal's stats from a config block that may carry either a PDF
 * path, pre-extracted `rawText`, or `stats` directly. Returns null when the
 * portal report is missing entirely.
 * @param {object|undefined} block
 * @param {"rea"|"domain"} portal
 */
export async function resolvePortalStats(block, portal) {
  if (!block) return null;
  if (block.stats) return { portal, comparison: null, reveals: null, searchAppearances: null, ...block.stats };
  if (block.pdfPath) return await extractStatsFromPdf(block.pdfPath, portal);
  if (block.rawText) return extractStatsFromText(block.rawText, portal);
  return null;
}
