"use client";

import { useMemo, useOptimistic } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/stage-badge";
import { MoveToExecutionDialog } from "@/components/move-to-execution-dialog";
import { ExecuteBlockedButton } from "@/components/execute-blocked-button";
import { CompleteDespiteRejectionDialog } from "@/components/complete-despite-rejection-dialog";
import {
  markLeadExecuted,
  markRoundExecuted,
  completeLeadDespiteRejection,
  type MarkExecutedInput,
} from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  isResolvedStatus,
  isLeadResolved,
  leadHasSessionAttempt,
  canCompleteDespiteRejection,
  effectiveStage,
} from "@/lib/types";
import type { Lead, LeadRound, Team } from "@/lib/types";

/** Same as leads-table.tsx's helper: the one round a lead's quick execute
 * button should target — round 1 if unresolved, else whichever later round
 * is next in line, so the button doesn't vanish once round 1 is done while a
 * later round is still pending. Round 1 counts as settled once it's either
 * executed or resolved via its own status (e.g. Rejected) — otherwise a
 * rejected lead would still show "Mark as executed" just because it never
 * got an executed_date. */
function findPendingRound(
  lead: Lead,
  roundsByLead: Map<string, LeadRound[]>,
): { kind: "lead" } | { kind: "round"; round: LeadRound } | null {
  if (!lead.executed_date && !isResolvedStatus(lead.status)) return { kind: "lead" };
  const rounds = (roundsByLead.get(lead.id) ?? [])
    .filter((r) => !r.executed_date && !isResolvedStatus(r.status))
    .sort((a, b) => a.sequence_no - b.sequence_no);
  return rounds.length > 0 ? { kind: "round", round: rounds[0] } : null;
}

export function LeadsKanban({
  leads,
  rounds = [],
  teams,
  showTeamLabel,
  canEdit = true,
}: {
  leads: Lead[];
  /** Every round across every lead shown — grouped internally per lead so the
   * quick execute button can target whichever round is actually pending. */
  rounds?: LeadRound[];
  teams: Team[];
  showTeamLabel: boolean;
  /** False for a view-only role (team_admin) — hides the "Mark as executed" action. */
  canEdit?: boolean;
}) {
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";
  const roundsByLead = useMemo(() => {
    const map = new Map<string, LeadRound[]>();
    for (const r of rounds) {
      const arr = map.get(r.lead_id) ?? [];
      arr.push(r);
      map.set(r.lead_id, arr);
    }
    return map;
  }, [rounds]);

  // With 1000+ leads, revalidating /leads after a mutation can take several
  // seconds — without this, confirming "Mark as executed" closes the dialog
  // but the card just sits in its old column with no feedback until the slow
  // refetch eventually lands, which reads as broken. Move it immediately;
  // the real data reconciles once the server round-trip finishes.
  const [optimisticLeads, markExecutedOptimistically] = useOptimistic(
    leads,
    (state, leadId: string) =>
      state.map((l) =>
        l.id === leadId ? { ...l, status: "Activity Completed" } : l,
      ),
  );

  async function handleConfirm(
    pending: { kind: "lead" } | { kind: "round"; round: LeadRound },
    leadId: string,
    input: MarkExecutedInput,
  ) {
    markExecutedOptimistically(leadId);
    if (pending.kind === "lead") {
      await markLeadExecuted(leadId, input);
    } else {
      await markRoundExecuted(pending.round.id, leadId, input);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:overflow-visible">
      {STAGE_ORDER.map((stage) => {
        const stageLeads = optimisticLeads.filter(
          (l) => effectiveStage(l, roundsByLead.get(l.id) ?? []) === stage,
        );
        return (
          <div
            key={stage}
            className="flex w-64 shrink-0 flex-col gap-2 md:w-auto"
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-neutral-700">
                {STAGE_LABELS[stage]}
              </h3>
              <span className="text-xs text-neutral-400">
                {stageLeads.length}
              </span>
            </div>
            <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
              {stageLeads.map((lead) => {
                const leadRounds = roundsByLead.get(lead.id) ?? [];
                const pending = findPendingRound(lead, roundsByLead);
                const hasContactDetails = !!(
                  lead.contact_person && (lead.mobile_no || lead.email_id)
                );
                const canComplete = canCompleteDespiteRejection(lead, leadRounds);
                const blockedMessage = canComplete
                  ? undefined
                  : isLeadResolved(lead)
                    ? "This lead is already resolved — nothing left to execute."
                    : leadHasSessionAttempt(lead, leadRounds)
                      ? undefined
                      : "You haven't planned any session yet — please try to plan one first.";
                return (
                  <Card key={lead.id} className="gap-2 py-3">
                    <CardHeader className="px-3">
                      <CardTitle className="text-sm">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="hover:underline"
                        >
                          {lead.institution_name}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 px-3 text-xs text-neutral-600">
                      <div>{lead.responsible_member || "—"}</div>
                      {showTeamLabel && <div>{teamName(lead.team_id)}</div>}
                      {lead.sub_team && <div>{lead.sub_team}</div>}
                      <div>
                        {[lead.region, lead.state].filter(Boolean).join(" / ") ||
                          "—"}
                      </div>
                      <div>Planned: {lead.planned_date ?? "—"}</div>
                      <StatusBadge status={lead.status} />
                      {canEdit && pending?.kind === "lead" && (
                        <MoveToExecutionDialog
                          title={lead.institution_name}
                          initialActivityUndertaken={lead.activity_undertaken ?? lead.planned_activity}
                          initialGirlsReached={lead.girls_reached}
                          hasContactDetails={hasContactDetails}
                          onConfirm={(input) => handleConfirm(pending, lead.id, input)}
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-1 w-full"
                            >
                              Mark as executed
                            </Button>
                          }
                        />
                      )}
                      {canEdit && pending?.kind === "round" && (
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
                          onConfirm={(input) => handleConfirm(pending, lead.id, input)}
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-1 w-full"
                            >
                              Mark as executed
                            </Button>
                          }
                        />
                      )}
                      {canEdit && !pending && canComplete && (
                        <CompleteDespiteRejectionDialog
                          title={lead.institution_name}
                          hasContactDetails={hasContactDetails}
                          onConfirm={completeLeadDespiteRejection.bind(null, lead.id)}
                          trigger={
                            <Button size="sm" className="mt-1 w-full">
                              Mark as Completed
                            </Button>
                          }
                        />
                      )}
                      {canEdit && !pending && !canComplete && (
                        <ExecuteBlockedButton
                          message={blockedMessage}
                          className="mt-1 w-full"
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
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
