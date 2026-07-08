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
  recent: {
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

/**
 * Team-wise leads: an all-teams consolidated total up top, then a collapsible
 * per-team breakdown below — a proportional stage bar for scanning at a
 * glance, expandable to that team's most recent leads.
 */
export function AdminTeamBreakdown({ rows }: { rows: TeamBreakdownRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">No team has any leads yet.</p>
    );
  }

  const totals = sumRows(rows);
  const consolidated: { label: string; value: number }[] = [
    { label: "Total leads (all teams)", value: totals.total },
    { label: "Completed", value: totals.completed },
    { label: "Planned girls reach", value: totals.plannedGirls },
    { label: "Girls reached", value: totals.girlsReached },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {consolidated.map((stat) => (
          <div
            key={stat.label}
            className="rounded-md border bg-neutral-50 px-3 py-2"
          >
            <div className="text-xs text-neutral-500">{stat.label}</div>
            <div className="text-lg font-semibold tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const isOpen = openId === row.teamId;
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
                  <span className="whitespace-nowrap text-xs text-neutral-400">
                    {row.total} lead{row.total === 1 ? "" : "s"}
                  </span>
                  <span className="whitespace-nowrap text-xs text-neutral-400">
                    · {row.completed} completed
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
                  <div className="flex flex-col">
                    {row.recent.map((r) => (
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
                    {row.total > row.recent.length && (
                      <div className="border-t px-4 py-2 text-xs text-neutral-400">
                        + {row.total - row.recent.length} more — see the Leads
                        page
                      </div>
                    )}
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
