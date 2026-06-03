import { NextRequest, NextResponse } from "next/server";
import { getVendorReportComps } from "@/lib/everypropertyai";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/local-market
 *   ?address=14 Hartsmere Drive Berwick VIC 3806   (geocoded by the endpoint)
 *   ?lat=-38.0306&lng=145.3450                     (preferred when available)
 *   &radius=0.5
 *
 * Server-side holder of the everypropertyAI Bearer key — the browser only ever
 * talks to this same-origin route. Returns { solds, listings } (each up to 3).
 * Degrades gracefully: the underlying client fails soft to empty arrays.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = sp.get("lat");
  const lng = sp.get("lng");
  const address = sp.get("address") ?? undefined;
  const radius = sp.get("radius");

  if (lat == null && !address) {
    return NextResponse.json({ error: "Provide lat+lng or address" }, { status: 400 });
  }

  const { solds, listings } = await getVendorReportComps({
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    address,
    radius: radius != null ? Number(radius) : undefined,
    // Drop the subject's own row from results when we queried by address.
    excludeAddress: address,
  });

  return NextResponse.json({ solds, listings });
}
