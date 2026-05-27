import { NextRequest, NextResponse } from "next/server";
import { GenerateReportInput } from "@/lib/types";
import { callMiniMax } from "@/lib/minimax";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "MINIMAX_API_KEY not configured" }, { status: 500 });
  }

  const input: Partial<GenerateReportInput> = await req.json();
  const suburb = input.propertyAddress?.split(",")[1]?.trim() ?? "the area";

  const prompt = `You are a Melbourne real estate agent at Grants Estate Agents writing your personal weekly notes about a property campaign.

Write a candid, first-person market commentary paragraph (3–5 sentences) that the agent can send to their vendor. It should:
- Comment on the current market conditions in ${suburb} and what that means for this campaign
- Reference the campaign stats below to frame buyer interest
- Mention any relevant seasonal or economic factors (autumn 2026 market, interest rate environment, etc.)
- Sound like a knowledgeable local agent talking to a client — not a corporate press release
- Be specific enough to be credible, but not fabricate details you don't have
- Do NOT use the phrase "I'll be straight with you" or any close variant ("to be straight", "being straight", "honestly", "I'll be honest")

CAMPAIGN STATS SO FAR:
- Address: ${input.propertyAddress || "—"}
- Campaign type: ${input.campaignType || "—"}
- Days on market: ${input.daysOnMarket || "—"}
- Asking price: ${input.askingPrice || "—"}
- REA views: ${input.reaViews || "—"} | Enquiries: ${input.reaEnquiries || "—"} | Saves: ${input.reaSaves || "—"}
- Domain views: ${input.domainViews || "—"} | Enquiries: ${input.domainEnquiries || "—"} | Saves: ${input.domainSaves || "—"}
- Open home attendees: ${input.openHomeAttendees || "0"} | Private inspections: ${input.privateInspections || "0"}
- Inspection notes: ${input.inspectionNotes || "none"}

Return only the commentary text. No preamble, no labels, no quotes.`;

  try {
    const commentary = await callMiniMax(apiKey, [{ role: "user", content: prompt }], {
      temperature: 0.8,
      max_tokens: 4000,
    });
    return NextResponse.json({ commentary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
