"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/stage-badge";
import { MoveToExecutionDialog } from "@/components/move-to-execution-dialog";
import { markLeadExecuted } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS, STAGE_ORDER, stageForStatus } from "@/lib/types";
import type { Lead, Team } from "@/lib/types";

export function LeadsKanban({
  leads,
  teams,
  showTeamLabel,
}: {
  leads: Lead[];
  teams: Team[];
  showTeamLabel: boolean;
}) {
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:overflow-visible">
      {STAGE_ORDER.map((stage) => {
        const stageLeads = leads.filter((l) => stageForStatus(l.status) === stage);
        return (
          <div key={stage} className="flex w-64 shrink-0 flex-col gap-2 md:w-auto">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-neutral-700">{STAGE_LABELS[stage]}</h3>
              <span className="text-xs text-neutral-400">{stageLeads.length}</span>
            </div>
            <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
              {stageLeads.map((lead) => (
                <Card key={lead.id} className="gap-2 py-3">
                  <CardHeader className="px-3">
                    <CardTitle className="text-sm">
                      <Link href={`/leads/${lead.id}`} className="hover:underline">
                        {lead.institution_name}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 px-3 text-xs text-neutral-600">
                    {showTeamLabel && <div>{teamName(lead.team_id)}</div>}
                    <div>{[lead.region, lead.state].filter(Boolean).join(" / ") || "—"}</div>
                    <div>Planned: {lead.planned_date ?? "—"}</div>
                    <StatusBadge status={lead.status} />
                    {!lead.executed_date && (
                      <MoveToExecutionDialog
                        title={lead.institution_name}
                        initialActivityUndertaken={lead.activity_undertaken}
                        initialGirlsReached={lead.girls_reached}
                        onConfirm={markLeadExecuted.bind(null, lead.id)}
                        trigger={
                          <Button size="sm" variant="outline" className="mt-1 w-full">
                            Mark as executed
                          </Button>
                        }
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
              {stageLeads.length === 0 && (
                <p className="px-1 text-xs text-neutral-400">Nothing here.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
