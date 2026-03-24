import { NextRequest, NextResponse } from "next/server";
import { fetchContacts } from "@/lib/ghl";

export async function GET(request: NextRequest) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    return NextResponse.json(
      { error: "GHL_API_KEY and GHL_LOCATION_ID must be set in environment variables." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 20);
  const startAfterId = searchParams.get("startAfterId") ?? undefined;
  const query = searchParams.get("query") ?? undefined;

  try {
    const data = await fetchContacts(locationId, apiKey, { limit, startAfterId, query });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
