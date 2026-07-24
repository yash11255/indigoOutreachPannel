"use client";

import { useDeferredValue, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MoveToExecutionDialog } from "@/components/move-to-execution-dialog";
import { ExecuteBlockedButton } from "@/components/execute-blocked-button";
import { CompleteDespiteRejectionDialog } from "@/components/complete-despite-rejection-dialog";
import { markLeadExecuted, markRoundExecuted, completeLeadDespiteRejection } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import {
  stageForStatus,
  isLeadResolved,
  leadHasSessionAttempt,
  canCompleteDespiteRejection,
  type Lead,
  type LeadRound,
  type Team,
} from "@/lib/types";

/** The one round a lead's quick "Mark as executed" button in a list view
 * should target: round 1 (the lead itself) if it's still unresolved,
 * otherwise whichever later round is next in line — so the button doesn't
 * just vanish once round 1 is done while a later round is still pending. */
function findPendingRound(
  lead: Lead,
  roundsByLead: Map<string, LeadRound[]>,
): { kind: "lead" } | { kind: "round"; round: LeadRound } | null {
  if (!lead.executed_date) return { kind: "lead" };
  const rounds = (roundsByLead.get(lead.id) ?? [])
    .filter((r) => !r.executed_date && stageForStatus(r.status) !== "stalled")
    .sort((a, b) => a.sequence_no - b.sequence_no);
  return rounds.length > 0 ? { kind: "round", round: rounds[0] } : null;
}

export function LeadsTable({
  leads: allLeads,
  rounds = [],
  teams,
  showTeamColumn,
  canEdit = true,
  searchable,
}: {
  leads: Lead[];
  /** Every round across every lead shown — grouped internally per lead so the
   * quick execute button can target whichever round is actually pending. */
  rounds?: LeadRound[];
  teams: Team[];
  showTeamColumn: boolean;
  /** False for a view-only role (team_admin) — hides the Actions column entirely rather than showing a button that RLS would silently reject. */
  canEdit?: boolean;
  /** Shows a client-side search box above the list. Off by default so callers that already filter/search upstream (like the main Leads page) don't get a second, redundant box. */
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const roundsByLead = useMemo(() => {
    const map = new Map<string, LeadRound[]>();
    for (const r of rounds) {
      const arr = map.get(r.lead_id) ?? [];
      arr.push(r);
      map.set(r.lead_id, arr);
    }
    return map;
  }, [rounds]);
  // Keeps the input itself responsive while the (expensive, O(n) over every
  // lead) filter below lags a beat behind on a big list — without this, each
  // keystroke synchronously re-filters 1000+ rows before the input updates.
  const deferredQuery = useDeferredValue(query);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";
  const teamNameById = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name])),
    [teams],
  );

  const leads = useMemo(() => {
    if (!searchable || !deferredQuery.trim()) return allLeads;
    const q = deferredQuery.trim().toLowerCase();
    return allLeads.filter((l) =>
      [
        l.institution_name,
        l.responsible_member,
        l.sub_team,
        teamNameById.get(l.team_id),
        l.region,
        l.state,
        l.district_city,
        l.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [allLeads, deferredQuery, searchable, teamNameById]);

  const showSubTeamColumn = leads.some((l) => l.sub_team);

  if (allLeads.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">
        No leads yet.
      </p>
    );
  }

  return (
    <>
      {searchable && (
        <div className="mb-3 flex flex-col gap-1.5">
          <Input
            placeholder="Search by institution, member, region, status…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <p className="text-xs text-neutral-400">
              {leads.length} of {allLeads.length} leads
            </p>
          )}
        </div>
      )}
      {leads.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">
          No leads match &quot;{query}&quot;.
        </p>
      ) : (
        <>
          {/* Card list below sm — a wide table with 8 columns doesn't work at phone width. */}
          <div className="flex flex-col gap-3 sm:hidden">
            {leads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex flex-col gap-2 rounded-md border p-3 hover:bg-neutral-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{lead.institution_name}</span>
                  <StatusBadge status={lead.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                  <span>{lead.responsible_member || "—"}</span>
                  {showTeamColumn && <span>{teamName(lead.team_id)}</span>}
                  {lead.sub_team && (
                    <Badge variant="outline">{lead.sub_team}</Badge>
                  )}
                  <span>
                    {[lead.region, lead.state].filter(Boolean).join(" / ") ||
                      "—"}
                  </span>
                  <span>Planned {lead.planned_date ?? "—"}</span>
                  {lead.executed_date && (
                    <span>Executed {lead.executed_date}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-md border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institution</TableHead>
                  <TableHead>By</TableHead>
                  {showTeamColumn && <TableHead>Team</TableHead>}
                  {showSubTeamColumn && <TableHead>Sub-team</TableHead>}
                  <TableHead>Region / State</TableHead>
                  <TableHead>Planned date</TableHead>
                  <TableHead>Executed date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const leadRounds = roundsByLead.get(lead.id) ?? [];
                  const pending = findPendingRound(lead, roundsByLead);
                  const hasContactDetails = !!(
                    lead.contact_person && (lead.mobile_no || lead.email_id)
                  );
                  const canComplete = canCompleteDespiteRejection(lead, leadRounds);
                  const blockedMessage = canComplete
                    ? undefined // handled by the "Mark as Completed" button instead
                    : isLeadResolved(lead)
                      ? "This lead is already resolved — nothing left to execute."
                      : leadHasSessionAttempt(lead, leadRounds)
                        ? undefined // a session was attempted but not yet resolved elsewhere — shouldn't normally hit "no pending" in that case
                        : "You haven't planned any session yet — please try to plan one first.";
                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="hover:underline"
                        >
                          {lead.institution_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-neutral-500">
                        {lead.responsible_member || "—"}
                      </TableCell>
                      {showTeamColumn && (
                        <TableCell>{teamName(lead.team_id)}</TableCell>
                      )}
                      {showSubTeamColumn && (
                        <TableCell className="text-sm text-neutral-500">
                          {lead.sub_team || "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        {[lead.region, lead.state].filter(Boolean).join(" / ") ||
                          "—"}
                      </TableCell>
                      <TableCell>{lead.planned_date ?? "—"}</TableCell>
                      <TableCell>{lead.executed_date ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell>
                        <StageBadge status={lead.status} />
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          {pending?.kind === "lead" && (
                            <MoveToExecutionDialog
                              title={lead.institution_name}
                              initialActivityUndertaken={lead.activity_undertaken ?? lead.planned_activity}
                              initialGirlsReached={lead.girls_reached}
                              hasContactDetails={hasContactDetails}
                              onConfirm={markLeadExecuted.bind(null, lead.id)}
                              trigger={
                                <Button size="sm" variant="outline">
                                  Mark as executed
                                </Button>
                              }
                            />
                          )}
                          {pending?.kind === "round" && (
                            <MoveToExecutionDialog
                              title={`Round ${pending.round.sequence_no} — ${lead.institution_name}`}
                              initialActivityUndertaken={
                                pending.round.activity_undertaken ?? pending.round.title
                              }
                              initialGirlsReached={pending.round.girls_reached}
                              initialTotalStudents={pending.round.no_of_institutions}
                              initialDriveLink={pending.round.drive_link}
                              priorSessionActivities={[
                                lead.activity_undertaken,
                                ...(roundsByLead.get(lead.id) ?? []).map((r) => r.activity_undertaken),
                              ]}
                              hasContactDetails={hasContactDetails}
                              onConfirm={markRoundExecuted.bind(null, pending.round.id, lead.id)}
                              trigger={
                                <Button size="sm" variant="outline">
                                  Mark as executed
                                </Button>
                              }
                            />
                          )}
                          {!pending && canComplete && (
                            <CompleteDespiteRejectionDialog
                              title={lead.institution_name}
                              hasContactDetails={hasContactDetails}
                              onConfirm={completeLeadDespiteRejection.bind(null, lead.id)}
                              trigger={<Button size="sm">Mark as Completed</Button>}
                            />
                          )}
                          {!pending && !canComplete && (
                            <ExecuteBlockedButton message={blockedMessage} />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
