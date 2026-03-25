"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GHLContact } from "@/lib/ghl";

interface PipelineStage {
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  position: number;
  count: number;
}

interface DashboardData {
  stats: { total: number; today: number; week: number; month: number };
  recentContacts: GHLContact[];
  pipelineStages: PipelineStage[];
  totalOpportunities: number;
}

const STAGE_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-rose-500",
];

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatCard({
  label,
  value,
  sub,
  colorClass,
  icon,
}: {
  label: string;
  value: number;
  sub: string;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${colorClass}`}>
          {value.toLocaleString()}
        </p>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass.replace("text-", "bg-").replace("-600", "-100").replace("-500", "-100")}`}>
        <span className={colorClass}>{icon}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div>
          <div className="h-7 bg-gray-200 rounded w-40 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-56" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 h-72" />
          <div className="bg-white rounded-2xl border border-gray-100 h-72" />
        </div>
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

  if (!data) return null;

  const maxCount = Math.max(...data.pipelineStages.map((s) => s.count), 1);
  const currentMonth = new Date().toLocaleString("default", { month: "long" });

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Leads"
          value={data.stats.total}
          sub="All time"
          colorClass="text-indigo-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="This Month"
          value={data.stats.month}
          sub={currentMonth}
          colorClass="text-blue-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="This Week"
          value={data.stats.week}
          sub="Since Sunday"
          colorClass="text-violet-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard
          label="Today"
          value={data.stats.today}
          sub="New leads today"
          colorClass="text-emerald-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-gray-900">Pipeline Overview</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {data.totalOpportunities.toLocaleString()} open opportunities
              </p>
            </div>
            <Link
              href="/pipeline"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              View full pipeline
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {data.pipelineStages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">No pipeline stages found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.pipelineStages.map((stage, i) => (
                <div key={stage.stageId} className="flex items-center gap-3">
                  <span className="w-36 text-sm text-gray-600 truncate flex-shrink-0">
                    {stage.stageName}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${STAGE_COLORS[i % STAGE_COLORS.length]}`}
                      style={{
                        width: `${Math.max(
                          (stage.count / maxCount) * 100,
                          stage.count > 0 ? 3 : 0
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="w-9 text-right text-sm font-semibold text-gray-700 flex-shrink-0">
                    {stage.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent leads */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-900">Recent Leads</h2>
            <Link
              href="/contacts"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              All contacts
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {data.recentContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">No contacts yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recentContacts.map((contact) => {
                const name =
                  [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                  contact.email ||
                  "Unnamed";
                const initials = name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <div key={contact.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {contact.email && (
                        <p className="text-xs text-gray-400 truncate">{contact.email}</p>
                      )}
                    </div>
                    {contact.dateAdded && (
                      <p className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                        {timeAgo(contact.dateAdded)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
