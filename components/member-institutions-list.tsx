"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { StageBadge } from "@/components/stage-badge";
import type { MemberInstitutionsGroup, Team } from "@/lib/types";

/** Team-member rows that expand in place to show which institutions each person is working — click a name to open/close it. */
export function MemberInstitutionsList({
  groups,
  teams,
  showTeamColumn,
}: {
  groups: MemberInstitutionsGroup[];
  teams: Team[];
  showTeamColumn: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";

  function toggle(member: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(member)) next.delete(member);
      else next.add(member);
      return next;
    });
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-200">
      {groups.map(({ member, leads }) => {
        const isOpen = expanded.has(member);
        return (
          <div key={member}>
            <button
              type="button"
              onClick={() => toggle(member)}
              className="flex w-full items-center justify-between gap-2 py-2.5 text-left hover:bg-neutral-50"
            >
              <span className="flex items-center gap-2 font-medium">
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                {member}
              </span>
              <span className="text-sm text-neutral-500">
                {leads.length} lead{leads.length === 1 ? "" : "s"}
              </span>
            </button>
            {isOpen && (
              <div className="ml-6 flex flex-col gap-1 pb-3">
                {leads.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-100 bg-neutral-50/60 px-3 py-1.5 text-sm"
                  >
                    <Link href={`/leads/${l.id}`} className="hover:underline">
                      {l.institution_name}
                    </Link>
                    <span className="flex items-center gap-2 text-neutral-500">
                      {showTeamColumn && <span>{teamName(l.team_id)}</span>}
                      {l.state && <span>{l.state}</span>}
                      <StageBadge status={l.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-500">
          No leads match the current filters.
        </p>
      )}
    </div>
  );
}
