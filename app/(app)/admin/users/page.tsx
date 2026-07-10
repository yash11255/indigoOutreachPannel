import { requireAdmin } from "@/lib/data/session";
import { getAllProfiles } from "@/lib/data/admin";
import { getTeams, getSubTeamsByTeam } from "@/lib/data/lookups";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateMemberForm } from "./create-member-form";
import { CreateTeamForm } from "./create-team-form";
import { SearchableUsersTable } from "./searchable-users-table";
import { SearchableTeamsTable } from "./searchable-teams-table";

export default async function AdminUsersPage() {
  await requireAdmin();
  const [profiles, teams, subTeamsByTeam] = await Promise.all([
    getAllProfiles(),
    getTeams(),
    getSubTeamsByTeam(),
  ]);
  const homeTeams = Array.from(
    new Set(profiles.map((p) => p.home_team).filter((t): t is string => !!t)),
  ).sort();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-neutral-500">
          Create logins for teammates and assign their team + role. There is no
          public sign-up — accounts are created here.
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          <strong>Home team</strong> is their CSR client-account or internal
          department — reference only, doesn&apos;t affect stats.{" "}
          <strong>Outreach team</strong> is which pipeline their leads count
          toward, and is the one that drives every stat in the app.
        </p>
      </div>

      <CreateTeamForm />

      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchableTeamsTable teams={teams} />
          <p className="mt-2 text-xs text-neutral-400">
            Rename a team here. To move someone into a different team, edit
            their row in the table below and pick from the Team dropdown.
          </p>
        </CardContent>
      </Card>

      <CreateMemberForm teams={teams} subTeamsByTeam={subTeamsByTeam} homeTeams={homeTeams} />

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchableUsersTable
            profiles={profiles}
            teams={teams}
            subTeamsByTeam={subTeamsByTeam}
            homeTeams={homeTeams}
          />
        </CardContent>
      </Card>
    </div>
  );
}
