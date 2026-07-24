import { requireProfile } from "@/lib/data/session";
import { getLeads, getAllLeadRounds } from "@/lib/data/leads";
import { getTeams, getStatuses, getRegionsStates, getDistrictsMaster } from "@/lib/data/lookups";
import { DueBanner } from "@/components/due-banner";
import { LeadsView } from "./leads-view";
import { stageForStatus, groupRoundsByLead } from "@/lib/types";
import { hasAwarenessSession } from "@/lib/outreach-taxonomy";

export default async function LeadsPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const isTeamAdmin = profile.role === "team_admin";

  // No team-based filter here: RLS already scopes rows to what this profile
  // is allowed to see (their own leads, plus their direct reports' if
  // they're someone's manager, plus their team — or just one sub-division of
  // it, if they're a view-only team_admin scoped that narrowly; everything
  // for full admins). Same RLS scoping applies to lead_rounds, needed so the
  // list view's quick "Mark as executed" button can target whichever round
  // is actually still pending, not just round 1.
  const [leads, rounds, teams, statuses, regionsStates, districtsMaster] = await Promise.all([
    getLeads(),
    getAllLeadRounds(),
    getTeams(),
    getStatuses(),
    getRegionsStates(),
    getDistrictsMaster(),
  ]);

  // Due = planned but not yet executed, planned_date already arrived — a
  // strict subset of `leads` (already fetched, already sorted by planned_date
  // ascending), so this is a plain filter rather than a second full DB round
  // trip through getDueLeads().
  const today = new Date().toISOString().slice(0, 10);
  const dueLeads = leads.filter(
    (l) => l.planned_date !== null && l.planned_date <= today && l.executed_date === null,
  );

  const heading = isAdmin ? "All leads" : isTeamAdmin ? "Team leads" : "Your leads";
  const subtitle = isTeamAdmin
    ? profile.sub_team
      ? `View-only access to every lead in ${profile.sub_team}.`
      : "View-only access to every lead on your team."
    : "Create a lead with a planned date, then move it to execution once the activity happens.";

  // Top-of-page summary: how many are still open ("Planned" stage — includes
  // leads with real effort already on them but no session yet), how many are
  // fully done, and of those done, how many actually have a genuine session
  // on record vs. were resolved some other way (e.g. cancelled).
  const roundsByLead = groupRoundsByLead(rounds);
  const plannedCount = leads.filter((l) => stageForStatus(l.status) === "planned").length;
  const completedLeads = leads.filter((l) => stageForStatus(l.status) === "completed");
  const completedWithSessionCount = completedLeads.filter((l) =>
    hasAwarenessSession([
      l.activity_undertaken,
      ...(roundsByLead.get(l.id) ?? []).map((r) => r.activity_undertaken),
    ]),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{heading}</h1>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-neutral-50 px-3.5 py-2.5">
          <div className="text-xs text-neutral-500">In Planned</div>
          <div className="text-lg font-semibold tabular-nums">{plannedCount}</div>
        </div>
        <div className="rounded-md border bg-neutral-50 px-3.5 py-2.5">
          <div className="text-xs text-neutral-500">Completed</div>
          <div className="text-lg font-semibold tabular-nums">{completedLeads.length}</div>
        </div>
        <div className="relative overflow-hidden rounded-md border bg-neutral-50 px-3.5 py-2.5">
          <div className="absolute inset-y-0 left-0 w-1 bg-[#24a148]" aria-hidden />
          <div className="text-xs text-neutral-500">Completed with a real session</div>
          <div className="text-lg font-semibold tabular-nums text-[#0e6027]">
            {completedWithSessionCount}
          </div>
        </div>
      </div>
      <DueBanner leads={dueLeads} />
      <LeadsView
        leads={leads}
        rounds={rounds}
        teams={teams}
        statuses={statuses}
        regionsStates={regionsStates}
        districtsMaster={districtsMaster}
        role={profile.role}
        defaultTeamId={profile.team_id}
        currentUserName={profile.full_name || profile.email}
      />
    </div>
  );
}
