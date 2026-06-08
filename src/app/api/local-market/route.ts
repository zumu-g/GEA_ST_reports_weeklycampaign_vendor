import { NextRequest, NextResponse } from "next/server";
import { getVendorReportComps } from "@/lib/everypropertyai";

export const runtime = "nodejs";
export const maxDuration = 60;

// Simple in-memory TTL cache to avoid hammering the upstream provider when the
// same property dashboard is refreshed repeatedly. Keyed by the query params.
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const cache = new Map<string, { ts: number; data: unknown }>();

function cacheGet(key: string): unknown | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

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

  const cacheKey = JSON.stringify({ lat, lng, address, radius });
  const cached = cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const { solds, listings } = await getVendorReportComps({
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      address,
      radius: radius != null ? Number(radius) : undefined,
      // Drop the subject's own row from results when we queried by address.
      excludeAddress: address,
    });

    const data = { solds, listings };
    cache.set(cacheKey, { ts: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    // Degrade gracefully rather than 500 — the dashboard tolerates empty data.
    return NextResponse.json({ solds: [], listings: [] });
  }
}
