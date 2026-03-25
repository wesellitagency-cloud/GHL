import { NextResponse } from "next/server";
import { fetchContacts, fetchPipelines, fetchOpportunities } from "@/lib/ghl";

function periodStart(period: "today" | "week" | "month"): string {
  const d = new Date();
  if (period === "today") {
    d.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    d.setDate(d.getDate() - d.getDay()); // rewind to Sunday
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

export async function GET() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    return NextResponse.json(
      { error: "GHL_API_KEY and GHL_LOCATION_ID must be set in environment variables." },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();

  const [totalRes, todayRes, weekRes, monthRes, recentRes, pipelinesRes, oppsRes] =
    await Promise.allSettled([
      fetchContacts(locationId, apiKey, { limit: 1 }),
      fetchContacts(locationId, apiKey, { limit: 1, startDate: periodStart("today"), endDate: now }),
      fetchContacts(locationId, apiKey, { limit: 1, startDate: periodStart("week"), endDate: now }),
      fetchContacts(locationId, apiKey, { limit: 1, startDate: periodStart("month"), endDate: now }),
      fetchContacts(locationId, apiKey, { limit: 10 }),
      fetchPipelines(locationId, apiKey),
      fetchOpportunities(locationId, apiKey, { limit: 100 }),
    ]);

  // Build stage → opportunity count map
  const stageCounts: Record<string, number> = {};
  if (oppsRes.status === "fulfilled") {
    for (const opp of oppsRes.value.opportunities) {
      stageCounts[opp.pipelineStageId] = (stageCounts[opp.pipelineStageId] ?? 0) + 1;
    }
  }

  const pipelines = pipelinesRes.status === "fulfilled" ? pipelinesRes.value.pipelines : [];

  const pipelineStages = pipelines
    .flatMap((pipeline) =>
      (pipeline.stages ?? []).map((stage) => ({
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        stageId: stage.id,
        stageName: stage.name,
        position: stage.position,
        count: stageCounts[stage.id] ?? 0,
      }))
    )
    .sort((a, b) => a.position - b.position);

  return NextResponse.json({
    stats: {
      total: totalRes.status === "fulfilled" ? totalRes.value.meta.total : 0,
      today: todayRes.status === "fulfilled" ? todayRes.value.meta.total : 0,
      week: weekRes.status === "fulfilled" ? weekRes.value.meta.total : 0,
      month: monthRes.status === "fulfilled" ? monthRes.value.meta.total : 0,
    },
    recentContacts:
      recentRes.status === "fulfilled" ? recentRes.value.contacts : [],
    pipelineStages,
    totalOpportunities:
      oppsRes.status === "fulfilled" ? oppsRes.value.meta.total : 0,
  });
}
