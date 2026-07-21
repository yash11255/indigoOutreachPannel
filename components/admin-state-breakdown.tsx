"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/stage-badge";
import { STAGE_LABELS, STAGE_ORDER, type LeadStage } from "@/lib/types";

const STAGE_COLOR: Record<LeadStage, string> = {
  planned: "#c6c6c6",
  outreach_sent: "#0f62fe",
  scheduled: "#f1c21b",
  completed: "#24a148",
  stalled: "#da1e28",
};

export type StateBreakdownRow = {
  state: string;
  region: string | null;
  total: number;
  completed: number;
  plannedGirls: number;
  girlsReached: number;
  stages: Record<LeadStage, number>;
  leads: {
    id: string;
    institution: string;
    district: string | null;
    status: string;
    plannedDate: string | null;
    executedDate: string | null;
  }[];
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function sumRows(rows: StateBreakdownRow[]) {
  return rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      completed: acc.completed + r.completed,
      plannedGirls: acc.plannedGirls + r.plannedGirls,
      girlsReached: acc.girlsReached + r.girlsReached,
    }),
    { total: 0, completed: 0, plannedGirls: 0, girlsReached: 0 },
  );
}

function completionPct(completed: number, total: number) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

const ACHIEVED_GREEN = "#24a148";

/** Groups a state's leads by district (most leads first). */
function groupByDistrict(leads: StateBreakdownRow["leads"]) {
  const map = new Map<string, StateBreakdownRow["leads"]>();
  for (const l of leads) {
    const key = l.district?.trim() || "Unspecified";
    const arr = map.get(key) ?? [];
    arr.push(l);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .map(([district, districtLeads]) => ({ district, leads: districtLeads }))
    .sort((a, b) => b.leads.length - a.leads.length);
}

/**
 * State-wise leads — same shape and interaction as Team-wise/Region-wise,
 * but flat by state (not nested under region first) since a state only has
 * one further sub-level worth breaking out: district straight to institution,
 * same as Team goes straight to member.
 */
export function AdminStateBreakdown({ rows }: { rows: StateBreakdownRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openDistricts, setOpenDistricts] = useState<Set<string>>(new Set());

  function toggleDistrict(key: string) {
    setOpenDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">No state has any leads yet.</p>
    );
  }

  const totals = sumRows(rows);
  const consolidated: { label: string; value: number; achieved?: boolean }[] = [
    { label: "Total leads (all states)", value: totals.total },
    { label: "Completed", value: totals.completed, achieved: true },
    { label: "Planned girls reach", value: totals.plannedGirls },
    { label: "Girls reached", value: totals.girlsReached, achieved: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {consolidated.map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-md border bg-neutral-50 py-2 pr-3 pl-3.5"
          >
            {stat.achieved && (
              <div
                className="absolute inset-y-0 left-0 w-1"
                style={{ backgroundColor: ACHIEVED_GREEN }}
                aria-hidden
              />
            )}
            <div className="text-xs text-neutral-500">{stat.label}</div>
            <div className="text-lg font-semibold tabular-nums">
              {stat.value.toLocaleString("en-IN")}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        <span className="font-medium text-neutral-600">Stage colors:</span>
        {STAGE_ORDER.map((stage) => (
          <span
            key={stage}
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: STAGE_COLOR[stage] }}
              aria-hidden
            />
            {STAGE_LABELS[stage]}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const isOpen = openId === row.state;
          const pct = completionPct(row.completed, row.total);
          const isFullyDone = row.total > 0 && row.completed === row.total;
          return (
            <div key={row.state} className="rounded-md border">
              <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : row.state)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-left"
                >
                  <span className="truncate font-semibold">{row.state}</span>
                  {row.region && (
                    <span className="whitespace-nowrap text-xs text-neutral-400">
                      {row.region}
                    </span>
                  )}
                  <span className="whitespace-nowrap text-xs text-neutral-500">
                    {row.total} lead{row.total === 1 ? "" : "s"}
                  </span>
                  <span
                    className={`whitespace-nowrap text-xs ${
                      isFullyDone
                        ? "font-medium text-[#0e6027]"
                        : "text-neutral-500"
                    }`}
                  >
                    · {isFullyDone ? "✓ " : ""}
                    {pct}% complete
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex h-2 w-28 overflow-hidden rounded-full bg-neutral-100 sm:w-36">
                    {STAGE_ORDER.map(
                      (stage) =>
                        row.stages[stage] > 0 && (
                          <div
                            key={stage}
                            style={{
                              width: `${(row.stages[stage] / row.total) * 100}%`,
                              backgroundColor: STAGE_COLOR[stage],
                            }}
                            title={`${STAGE_LABELS[stage]}: ${row.stages[stage]}`}
                          />
                        ),
                    )}
                  </div>
                  <Link
                    href={`/admin/segment?state=${encodeURIComponent(row.state)}`}
                    className="whitespace-nowrap rounded border px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    Full page — team &amp; member breakdown
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : row.state)}
                    aria-expanded={isOpen}
                    className={`text-xs text-neutral-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    ▶
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3 text-xs text-neutral-500">
                    {STAGE_ORDER.map((stage) => (
                      <span
                        key={stage}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <span
                          className="inline-block size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: STAGE_COLOR[stage] }}
                          aria-hidden
                        />
                        {STAGE_LABELS[stage]}{" "}
                        <span className="font-medium text-neutral-900">
                          {row.stages[stage]}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t px-4 py-3 text-xs text-neutral-500">
                    <div>
                      Planned girls reach{" "}
                      <span className="font-medium text-neutral-900">
                        {row.plannedGirls}
                      </span>
                    </div>
                    <div>
                      Girls reached{" "}
                      <span className="font-medium text-neutral-900">
                        {row.girlsReached}
                      </span>
                    </div>
                  </div>
                  <div className="flex max-h-96 flex-col overflow-y-auto border-t">
                    {groupByDistrict(row.leads).map(({ district, leads: districtLeads }) => {
                      const districtKey = `${row.state}:${district}`;
                      const districtOpen = openDistricts.has(districtKey);
                      return (
                        <div key={district}>
                          <button
                            type="button"
                            onClick={() => toggleDistrict(districtKey)}
                            className="flex w-full items-center justify-between gap-2 border-t px-4 py-2 text-left text-sm hover:bg-neutral-50"
                          >
                            <span className="flex min-w-0 items-baseline gap-2 truncate font-medium">
                              <span
                                className={`inline-block shrink-0 text-xs text-neutral-400 transition-transform ${districtOpen ? "rotate-90" : ""}`}
                              >
                                ▶
                              </span>
                              <span className="truncate">{district}</span>
                            </span>
                            <span className="shrink-0 text-xs text-neutral-500">
                              {districtLeads.length} lead
                              {districtLeads.length === 1 ? "" : "s"}
                            </span>
                          </button>
                          {districtOpen && (
                            <div className="flex flex-col gap-1 bg-neutral-50/60 px-4 py-2 pl-9">
                              {districtLeads.map((r) => (
                                <Link
                                  key={r.id}
                                  href={`/leads/${r.id}`}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-100 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">
                                      {r.institution}
                                    </div>
                                    <div className="flex flex-wrap gap-x-2 text-xs text-neutral-400">
                                      {formatDate(r.plannedDate) && (
                                        <span>Planned: {formatDate(r.plannedDate)}</span>
                                      )}
                                      {formatDate(r.executedDate) && (
                                        <span>Executed: {formatDate(r.executedDate)}</span>
                                      )}
                                    </div>
                                  </div>
                                  <StatusBadge status={r.status} />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
