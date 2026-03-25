"use client";

import { useEffect, useState } from "react";
import type { GHLOpportunity, GHLPipeline } from "@/lib/ghl";

interface PipelineResponse {
  pipelines: GHLPipeline[];
  opportunities: GHLOpportunity[];
  meta: { total: number };
}

const STAGE_STYLES = [
  { bar: "bg-blue-500",    badge: "bg-blue-50 text-blue-700",    dot: "bg-blue-500" },
  { bar: "bg-indigo-500",  badge: "bg-indigo-50 text-indigo-700",  dot: "bg-indigo-500" },
  { bar: "bg-violet-500",  badge: "bg-violet-50 text-violet-700",  dot: "bg-violet-500" },
  { bar: "bg-purple-500",  badge: "bg-purple-50 text-purple-700",  dot: "bg-purple-500" },
  { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  { bar: "bg-amber-500",   badge: "bg-amber-50 text-amber-700",   dot: "bg-amber-500" },
  { bar: "bg-orange-500",  badge: "bg-orange-50 text-orange-700",  dot: "bg-orange-500" },
  { bar: "bg-teal-500",    badge: "bg-teal-50 text-teal-700",    dot: "bg-teal-500" },
  { bar: "bg-rose-500",    badge: "bg-rose-50 text-rose-700",    dot: "bg-rose-500" },
];

export default function PipelinePage() {
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (selectedPipelineId) params.set("pipelineId", selectedPipelineId);

    setLoading(true);
    fetch(`/api/pipeline?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        if (!selectedPipelineId && d.pipelines?.length > 0) {
          setSelectedPipelineId(d.pipelines[0].id);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedPipelineId]);

  const currentPipeline = data?.pipelines.find((p) => p.id === selectedPipelineId);

  // Group opportunities by stage for the selected pipeline
  const byStage = new Map<string, GHLOpportunity[]>();
  if (currentPipeline && data) {
    for (const stage of currentPipeline.stages) {
      byStage.set(stage.id, []);
    }
    for (const opp of data.opportunities) {
      if (opp.pipelineId === selectedPipelineId) {
        const list = byStage.get(opp.pipelineStageId) ?? [];
        list.push(opp);
        byStage.set(opp.pipelineStageId, list);
      }
    }
  }

  const maxCount = Math.max(...[...byStage.values()].map((v) => v.length), 1);

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-40 mb-6" />
        {[...Array(7)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-16" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  const sortedStages = currentPipeline?.stages
    .slice()
    .sort((a, b) => a.position - b.position) ?? [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.meta.total.toLocaleString() ?? 0} total opportunities
            {data && data.meta.total > 100 && (
              <span className="ml-1 text-amber-600">(showing first 100)</span>
            )}
          </p>
        </div>

        {data && data.pipelines.length > 1 && (
          <select
            value={selectedPipelineId ?? ""}
            onChange={(e) => setSelectedPipelineId(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {data.pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!currentPipeline ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
          <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">No pipelines found in your GoHighLevel account.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedStages.map((stage, i) => {
            const opps = byStage.get(stage.id) ?? [];
            const styles = STAGE_STYLES[i % STAGE_STYLES.length];

            return (
              <div
                key={stage.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* Stage row */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex items-center gap-2.5 w-44 flex-shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${styles.dot}`} />
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      {stage.name}
                    </span>
                  </div>

                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${styles.bar} opacity-85 transition-all duration-500`}
                      style={{
                        width: `${Math.max(
                          (opps.length / maxCount) * 100,
                          opps.length > 0 ? 2 : 0
                        )}%`,
                      }}
                    />
                  </div>

                  <div
                    className={`px-3 py-1 rounded-full text-sm font-bold w-16 text-center flex-shrink-0 ${styles.badge}`}
                  >
                    {opps.length}
                  </div>
                </div>

                {/* Opportunity chips */}
                {opps.length > 0 && (
                  <div className="border-t border-gray-50 bg-gray-50/60 px-6 py-3">
                    <div className="flex flex-wrap gap-2">
                      {opps.slice(0, 10).map((opp) => (
                        <div
                          key={opp.id}
                          className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 max-w-xs"
                        >
                          <span className="text-xs font-medium text-gray-800 truncate">
                            {opp.contact?.name ?? opp.name}
                          </span>
                          {opp.monetaryValue != null && opp.monetaryValue > 0 && (
                            <span className="text-xs text-emerald-600 font-medium flex-shrink-0">
                              ${opp.monetaryValue.toLocaleString()}
                            </span>
                          )}
                        </div>
                      ))}
                      {opps.length > 10 && (
                        <div className="bg-white border border-dashed border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-400">
                          +{opps.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
