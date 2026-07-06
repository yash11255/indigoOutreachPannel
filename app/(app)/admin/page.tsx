import { requireAdmin } from "@/lib/data/session";
import { getLeads } from "@/lib/data/leads";
import { getTeams } from "@/lib/data/lookups";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IndiaMap } from "@/components/india-map";
import { STAGE_LABELS, STAGE_ORDER, stageForStatus } from "@/lib/types";

function sum(nums: (number | null)[]) {
  return nums.reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

export default async function AdminPage() {
  await requireAdmin();
  const [leads, teams] = await Promise.all([getLeads(), getTeams()]);

  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    count: leads.filter((l) => stageForStatus(l.status) === stage).length,
  }));

  const byTeam = teams.map((team) => {
    const teamLeads = leads.filter((l) => l.team_id === team.id);
    return {
      team,
      total: teamLeads.length,
      completed: teamLeads.filter((l) => stageForStatus(l.status) === "completed").length,
      plannedGirls: sum(teamLeads.map((l) => l.planned_girls_reach)),
      girlsReached: sum(teamLeads.map((l) => l.girls_reached)),
    };
  });

  const regionMap = new Map<string, { total: number; completed: number }>();
  for (const l of leads) {
    const key = l.region ?? "Unspecified";
    const entry = regionMap.get(key) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (stageForStatus(l.status) === "completed") entry.completed += 1;
    regionMap.set(key, entry);
  }

  const memberMap = new Map<
    string,
    { total: number; planned: number; inProgress: number; completed: number; teamIds: Set<string> }
  >();
  for (const l of leads) {
    const key = l.responsible_member?.trim() || "Unassigned";
    const entry = memberMap.get(key) ?? {
      total: 0,
      planned: 0,
      inProgress: 0,
      completed: 0,
      teamIds: new Set<string>(),
    };
    entry.total += 1;
    entry.teamIds.add(l.team_id);
    const stage = stageForStatus(l.status);
    if (stage === "planned") entry.planned += 1;
    else if (stage === "completed") entry.completed += 1;
    else if (stage === "outreach_sent" || stage === "scheduled") entry.inProgress += 1;
    memberMap.set(key, entry);
  }
  const byMember = Array.from(memberMap.entries())
    .map(([member, stats]) => ({
      member,
      ...stats,
      teams: Array.from(stats.teamIds)
        .map((id) => teams.find((t) => t.id === id)?.name ?? "—")
        .join(", "),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Admin dashboard</h1>
        <p className="text-sm text-neutral-500">Cross-team view of the full outreach pipeline.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {byStage.map(({ stage, count }) => (
          <Card key={stage}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-neutral-500">
                {STAGE_LABELS[stage]}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{count}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By team</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Total leads</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Planned girls reach</TableHead>
                <TableHead>Girls reached</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byTeam.map((row) => (
                <TableRow key={row.team.id}>
                  <TableCell className="font-medium">{row.team.name}</TableCell>
                  <TableCell>{row.total}</TableCell>
                  <TableCell>{row.completed}</TableCell>
                  <TableCell>{row.plannedGirls}</TableCell>
                  <TableCell>{row.girlsReached}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By region</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Region</TableHead>
                <TableHead>Total leads</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(regionMap.entries()).map(([region, stats]) => (
                <TableRow key={region}>
                  <TableCell className="font-medium">{region}</TableCell>
                  <TableCell>{stats.total}</TableCell>
                  <TableCell>{stats.completed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where it&apos;s happening</CardTitle>
        </CardHeader>
        <CardContent>
          <IndiaMap leads={leads} teams={teams} isAdmin />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who&apos;s doing what</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsible member</TableHead>
                <TableHead>Team(s)</TableHead>
                <TableHead>Total leads</TableHead>
                <TableHead>Planned</TableHead>
                <TableHead>In progress</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byMember.map((row) => (
                <TableRow key={row.member}>
                  <TableCell className="font-medium">{row.member}</TableCell>
                  <TableCell className="text-sm text-neutral-500">{row.teams}</TableCell>
                  <TableCell>{row.total}</TableCell>
                  <TableCell>{row.planned}</TableCell>
                  <TableCell>{row.inProgress}</TableCell>
                  <TableCell>{row.completed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
