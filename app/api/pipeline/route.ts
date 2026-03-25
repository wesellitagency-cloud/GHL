import { NextRequest, NextResponse } from "next/server";
import { fetchPipelines, fetchOpportunities } from "@/lib/ghl";

export async function GET(request: NextRequest) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    return NextResponse.json(
      { error: "GHL_API_KEY and GHL_LOCATION_ID must be set." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const pipelineId = searchParams.get("pipelineId") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 100);
  const startAfterId = searchParams.get("startAfterId") ?? undefined;

  try {
    const [pipelinesData, oppsData] = await Promise.all([
      fetchPipelines(locationId, apiKey),
      fetchOpportunities(locationId, apiKey, { limit, startAfterId, pipelineId }),
    ]);

    return NextResponse.json({
      pipelines: pipelinesData.pipelines,
      opportunities: oppsData.opportunities,
      meta: oppsData.meta,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
