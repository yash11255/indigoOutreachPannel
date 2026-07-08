import { requireProfile } from "@/lib/data/session";
import { getLeads, getDueLeads } from "@/lib/data/leads";
import { getTeams, getStatuses, getRegionsStates, getDistrictsMaster } from "@/lib/data/lookups";
import { DueBanner } from "@/components/due-banner";
import { LeadsView } from "./leads-view";

export default async function LeadsPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  // No team-based filter here: RLS already scopes rows to what this profile
  // is allowed to see (their own leads, plus their direct reports' if
  // they're someone's manager; everything for admins).
  const [leads, dueLeads, teams, statuses, regionsStates, districtsMaster] = await Promise.all([
    getLeads(),
    getDueLeads(),
    getTeams(),
    getStatuses(),
    getRegionsStates(),
    getDistrictsMaster(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          {isAdmin ? "All leads" : "Your leads"}
        </h1>
        <p className="text-sm text-neutral-500">
          Create a lead with a planned date, then move it to execution once the activity happens.
        </p>
      </div>
      <DueBanner leads={dueLeads} />
      <LeadsView
        leads={leads}
        teams={teams}
        statuses={statuses}
        regionsStates={regionsStates}
        districtsMaster={districtsMaster}
        isAdmin={isAdmin}
        defaultTeamId={profile.team_id}
        currentUserName={profile.full_name || profile.email}
      />
    </div>
  );
}
