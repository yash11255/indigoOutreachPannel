import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/data/session";
import { getLead, getLeadRounds, getLeadUpdates } from "@/lib/data/leads";
import {
  getTeams,
  getStatuses,
  getRegionsStates,
  getAspirationalStatus,
  getDistrictsMaster,
} from "@/lib/data/lookups";
import { StageBadge, StatusBadge } from "@/components/stage-badge";
import { LeadFormDialog } from "@/components/lead-form";
import { MoveToExecutionDialog } from "@/components/move-to-execution-dialog";
import { AddRoundDialog } from "@/components/add-round-dialog";
import { AddUpdateDialog } from "@/components/add-update-dialog";
import { LeadTimeline } from "@/components/lead-timeline";
import { DeleteLeadButton } from "@/components/delete-lead-button";
import { markLeadExecuted, markRoundExecuted } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildLeadTimeline } from "@/lib/types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

function DriveLinkField({ value }: { value: string | null }) {
  return (
    <Field
      label="Drive link"
      value={
        value ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            View photos
          </a>
        ) : null
      }
    />
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  const [lead, rounds, updates, teams, statuses, regionsStates, districtsMaster] = await Promise.all([
    getLead(id),
    getLeadRounds(id),
    getLeadUpdates(id),
    getTeams(),
    getStatuses(),
    getRegionsStates(),
    getDistrictsMaster(),
  ]);

  if (!lead) notFound();

  const aspirational = await getAspirationalStatus(lead.state, lead.district_city);
  const teamName = teams.find((t) => t.id === lead.team_id)?.name ?? "—";
  const timeline = buildLeadTimeline(lead, rounds);
  // The step currently in progress (no executed date yet) — updates can only be logged against it.
  const activeStep = timeline.find((s) => !s.executedDate);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{lead.institution_name}</h1>
          <div className="mt-1 flex gap-2">
            <StatusBadge status={lead.status} />
            <StageBadge status={lead.status} />
            {aspirational?.is_aspirational && (
              <Badge variant="outline" className="border-[#8a3ffc] bg-[#f6f2ff] text-[#6929c4]">
                Aspirational District ({aspirational.district})
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <LeadFormDialog
            mode="edit"
            lead={lead}
            teams={teams}
            statuses={statuses}
            regionsStates={regionsStates}
            districtsMaster={districtsMaster}
            isAdmin={isAdmin}
            defaultTeamId={lead.team_id}
            currentUserName={profile.full_name || profile.email}
            trigger={<Button variant="outline">Edit</Button>}
          />
          {!lead.executed_date && (
            <MoveToExecutionDialog
              title={lead.institution_name}
              initialActivityUndertaken={lead.activity_undertaken}
              initialGirlsReached={lead.girls_reached}
              initialTotalStudents={lead.no_of_institutions}
              initialDriveLink={lead.drive_link}
              onConfirm={markLeadExecuted.bind(null, lead.id)}
              trigger={<Button>Mark as executed</Button>}
            />
          )}
          {isAdmin && <DeleteLeadButton leadId={lead.id} />}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-700">Progress</h2>
            <div className="flex gap-2">
              {activeStep && (
                <AddUpdateDialog
                  leadId={lead.id}
                  roundId={activeStep.roundId}
                  roundLabel={activeStep.title}
                  trigger={
                    <Button size="sm" variant="outline">
                      Add update
                    </Button>
                  }
                />
              )}
              <AddRoundDialog
                leadId={lead.id}
                trigger={
                  <Button size="sm" variant="outline">
                    Add another round
                  </Button>
                }
              />
            </div>
          </div>
          <LeadTimeline steps={timeline} />

          {updates.length > 0 && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Outreach updates
              </h3>
              <div className="flex flex-col gap-3">
                {updates.map((u) => {
                  const step = timeline.find((s) => s.roundId === u.round_id);
                  return (
                    <div key={u.id} className="text-sm">
                      <div className="flex flex-wrap items-baseline gap-2 text-xs text-neutral-400">
                        <span className="font-medium text-neutral-500">
                          {step?.title ?? "Round"}
                        </span>
                        <span>
                          {new Date(u.created_at).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      <p className="text-neutral-700">{u.note}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Team" value={teamName} />
          <Field label="Region" value={lead.region} />
          <Field label="State" value={lead.state} />
          <Field label="District / City" value={lead.district_city} />
          <Field label="Hobli / Taluk" value={lead.hobli} />
          <Field label="Outreach Pillar" value={lead.institution_type} />
          <Field label="Outreach Channel" value={lead.institution_channel} />
          <Field label="Outreach mode" value={lead.outreach_mode} />
          <Field label="Responsible member" value={lead.responsible_member} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Contact person" value={lead.contact_person} />
          <Field label="Designation" value={lead.designation} />
          <Field label="Mobile" value={lead.mobile_no} />
          <Field label="Email" value={lead.email_id} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-neutral-700">Round 1 — Planned</h2>
            <Field label="Planned activity" value={lead.planned_activity} />
            <Field label="Planned date" value={lead.planned_date} />
            <Field label="Total students" value={lead.no_of_institutions} />
            <Field label="Planned girls reach" value={lead.planned_girls_reach} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-neutral-700">Round 1 — Execution</h2>
            <Field label="Executed date" value={lead.executed_date} />
            <Field label="Activity undertaken" value={lead.activity_undertaken} />
            <Field label="Girls reached" value={lead.girls_reached} />
            <Field
              label="Interest forms submitted"
              value={lead.quick_interest_form_submitted}
            />
            <DriveLinkField value={lead.drive_link} />
          </CardContent>
        </Card>
      </div>

      {rounds.map((round) => (
        <Card key={round.id}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-700">
                Round {round.sequence_no} — {round.title || "Untitled"}
              </h2>
              <div className="flex items-center gap-2">
                <StatusBadge status={round.status} />
                {!round.executed_date && (
                  <MoveToExecutionDialog
                    title={`Round ${round.sequence_no}`}
                    initialActivityUndertaken={round.activity_undertaken}
                    initialGirlsReached={round.girls_reached}
                    initialTotalStudents={round.no_of_institutions}
                    initialDriveLink={round.drive_link}
                    onConfirm={markRoundExecuted.bind(null, round.id, lead.id)}
                    trigger={
                      <Button size="sm" variant="outline">
                        Mark as executed
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Planned date" value={round.planned_date} />
              <Field label="Total students" value={round.no_of_institutions} />
              <Field label="Total girls" value={round.planned_girls_reach} />
              <Field label="Executed date" value={round.executed_date} />
              <Field label="Activity undertaken" value={round.activity_undertaken} />
              <Field label="Girls reached" value={round.girls_reached} />
              <DriveLinkField value={round.drive_link} />
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <Field label="Remarks" value={lead.remarks} />
        </CardContent>
      </Card>
    </div>
  );
}
