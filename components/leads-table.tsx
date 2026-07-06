"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StageBadge, StatusBadge } from "@/components/stage-badge";
import { MoveToExecutionDialog } from "@/components/move-to-execution-dialog";
import { markLeadExecuted } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import type { Lead, Team } from "@/lib/types";

export function LeadsTable({
  leads,
  teams,
  showTeamColumn,
}: {
  leads: Lead[];
  teams: Team[];
  showTeamColumn: boolean;
}) {
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";

  if (leads.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-500">No leads yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Institution</TableHead>
            {showTeamColumn && <TableHead>Team</TableHead>}
            <TableHead>Region / State</TableHead>
            <TableHead>Planned date</TableHead>
            <TableHead>Executed date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="font-medium">
                <Link href={`/leads/${lead.id}`} className="hover:underline">
                  {lead.institution_name}
                </Link>
              </TableCell>
              {showTeamColumn && <TableCell>{teamName(lead.team_id)}</TableCell>}
              <TableCell>
                {[lead.region, lead.state].filter(Boolean).join(" / ") || "—"}
              </TableCell>
              <TableCell>{lead.planned_date ?? "—"}</TableCell>
              <TableCell>{lead.executed_date ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge status={lead.status} />
              </TableCell>
              <TableCell>
                <StageBadge status={lead.status} />
              </TableCell>
              <TableCell className="text-right">
                {!lead.executed_date && (
                  <MoveToExecutionDialog
                    title={lead.institution_name}
                    initialActivityUndertaken={lead.activity_undertaken}
                    initialGirlsReached={lead.girls_reached}
                    onConfirm={markLeadExecuted.bind(null, lead.id)}
                    trigger={
                      <Button size="sm" variant="outline">
                        Mark as executed
                      </Button>
                    }
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
