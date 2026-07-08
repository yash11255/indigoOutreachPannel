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

export type TeamBreakdownRow = {
  teamId: string;
  teamName: string;
  total: number;
  completed: number;
  plannedGirls: number;
  girlsReached: number;
  stages: Record<LeadStage, number>;
  leads: {
    id: string;
    institution: string;
    member: string | null;
    status: string;
  }[];
};

function sumRows(rows: TeamBreakdownRow[]) {
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

/**
 * Team-wise leads: an all-teams consolidated total up top, then a collapsible
 * per-team breakdown below — a proportional stage bar for scanning at a
 * glance, expandable to a scrollable list of every lead on that team.
 */
export function AdminTeamBreakdown({ rows }: { rows: TeamBreakdownRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">No team has any leads yet.</p>
    );
  }

  const totals = sumRows(rows);
  const consolidated: { label: string; value: number; achieved?: boolean }[] = [
    { label: "Total leads (all teams)", value: totals.total },
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
          const isOpen = openId === row.teamId;
          const pct = completionPct(row.completed, row.total);
          const isFullyDone = row.total > 0 && row.completed === row.total;
          return (
            <div key={row.teamId} className="rounded-md border">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : row.teamId)}
                aria-expanded={isOpen}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50"
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="truncate font-semibold">{row.teamName}</span>
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
                </div>
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
                  <span
                    className={`text-xs text-neutral-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t">
                  <div className="grid grid-cols-3 gap-4 px-4 py-3 text-xs text-neutral-500">
                    <div>
                      Completed{" "}
                      <span className="font-medium text-neutral-900">
                        {row.completed}
                      </span>
                    </div>
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
                  <div className="flex max-h-80 flex-col overflow-y-auto">
                    {row.leads.map((r) => (
                      <Link
                        key={r.id}
                        href={`/leads/${r.id}`}
                        className="flex items-center justify-between gap-3 border-t px-4 py-2 text-sm hover:bg-neutral-50"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {r.institution}
                          </div>
                          <div className="text-xs text-neutral-400">
                            {r.member ?? "—"}
                          </div>
                        </div>
                        <StatusBadge status={r.status} />
                      </Link>
                    ))}
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
