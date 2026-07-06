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
import { MemberRow } from "./member-row";

export default async function AdminUsersPage() {
  await requireAdmin();
  const [profiles, teams] = await Promise.all([getAllProfiles(), getTeams()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-neutral-500">
          Create logins for teammates and assign their team + role. There is no public
          sign-up — accounts are created here.
        </p>
      </div>

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
                <TableHead className="text-right">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <MemberRow key={p.id} profile={p} teams={teams} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
