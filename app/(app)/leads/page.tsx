import { requireProfile } from "@/lib/data/session";
import { getLeads, getDueLeads } from "@/lib/data/leads";
import { getTeams, getStatuses, getRegionsStates, getDistrictsMaster } from "@/lib/data/lookups";
import { DueBanner } from "@/components/due-banner";
import { LeadsView } from "./leads-view";

export default async function LeadsPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const isTeamAdmin = profile.role === "team_admin";

  // No team-based filter here: RLS already scopes rows to what this profile
  // is allowed to see (their own leads, plus their direct reports' if
  // they're someone's manager, plus their whole team if they're a
  // view-only team_admin; everything for full admins).
  const [leads, dueLeads, teams, statuses, regionsStates, districtsMaster] = await Promise.all([
    getLeads(),
    getDueLeads(),
    getTeams(),
    getStatuses(),
    getRegionsStates(),
    getDistrictsMaster(),
  ]);

  const heading = isAdmin ? "All leads" : isTeamAdmin ? "Team leads" : "Your leads";
  const subtitle = isTeamAdmin
    ? "View-only access to every lead on your team."
    : "Create a lead with a planned date, then move it to execution once the activity happens.";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{heading}</h1>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </div>
      <DueBanner leads={dueLeads} />
      <LeadsView
        leads={leads}
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
