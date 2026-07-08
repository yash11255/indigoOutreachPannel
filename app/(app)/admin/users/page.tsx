import { requireAdmin } from "@/lib/data/session";
import { getAllProfiles } from "@/lib/data/admin";
import { getTeams } from "@/lib/data/lookups";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateMemberForm } from "./create-member-form";
import { CreateTeamForm } from "./create-team-form";
import { MemberRow } from "./member-row";
import { TeamRow } from "./team-row";

export default async function AdminUsersPage() {
  await requireAdmin();
  const [profiles, teams] = await Promise.all([getAllProfiles(), getTeams()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-neutral-500">
          Create logins for teammates and assign their team + role. There is no
          public sign-up — accounts are created here.
        </p>
      </div>

      <CreateTeamForm />

      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t) => (
                <TeamRow key={t.id} team={t} />
              ))}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-neutral-400">
            Rename a team here. To move someone into a different team, edit
            their row in the table below and pick from the Team dropdown.
          </p>
        </CardContent>
      </Card>

      <CreateMemberForm teams={teams} />

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <MemberRow
                  key={p.id}
                  profile={p}
                  teams={teams}
                  allProfiles={profiles}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
