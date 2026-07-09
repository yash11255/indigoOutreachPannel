import Link from "next/link";
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
import {
  AdminTeamBreakdown,
  type TeamBreakdownRow,
} from "@/components/admin-team-breakdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  stageForStatus,
  type LeadStage,
} from "@/lib/types";

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
      completed: teamLeads.filter(
        (l) => stageForStatus(l.status) === "completed",
      ).length,
      plannedGirls: sum(teamLeads.map((l) => l.planned_girls_reach)),
      girlsReached: sum(teamLeads.map((l) => l.girls_reached)),
    };
  });

  const emptyStages = (): Record<LeadStage, number> => ({
    planned: 0,
    outreach_sent: 0,
    scheduled: 0,
    completed: 0,
    stalled: 0,
  });

  const teamActivity: TeamBreakdownRow[] = byTeam
    .filter((row) => row.total > 0)
    .map((row) => {
      const teamLeads = leads.filter((l) => l.team_id === row.team.id);
      const stages = emptyStages();
      for (const l of teamLeads) stages[stageForStatus(l.status)] += 1;
      const sortedLeads = teamLeads
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((l) => ({
          id: l.id,
          institution: l.institution_name,
          member: l.responsible_member,
          status: l.status,
        }));

      const subTeamMap = new Map<
        string,
        { total: number; completed: number; stages: Record<LeadStage, number> }
      >();
      for (const l of teamLeads) {
        const key = l.sub_team?.trim();
        if (!key) continue;
        const entry = subTeamMap.get(key) ?? {
          total: 0,
          completed: 0,
          stages: emptyStages(),
        };
        entry.total += 1;
        const stage = stageForStatus(l.status);
        entry.stages[stage] += 1;
        if (stage === "completed") entry.completed += 1;
        subTeamMap.set(key, entry);
      }
      const subTeams = Array.from(subTeamMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.total - a.total);

      return {
        teamId: row.team.id,
        teamName: row.team.name,
        total: row.total,
        completed: row.completed,
        plannedGirls: row.plannedGirls,
        girlsReached: row.girlsReached,
        stages,
        subTeams,
        leads: sortedLeads,
      };
    })
    .sort((a, b) => b.total - a.total);

  const dayMap = new Map<string, { total: number; completed: number }>();
  for (const l of leads) {
    const day = new Date(l.created_at).toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });
    const entry = dayMap.get(day) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (stageForStatus(l.status) === "completed") entry.completed += 1;
    dayMap.set(day, entry);
  }
  const byDay = Array.from(dayMap.entries())
    .map(([day, stats]) => ({ day, ...stats }))
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 30);
  const maxDayTotal = Math.max(1, ...byDay.map((d) => d.total));

  function formatDay(isoDay: string) {
    return new Date(`${isoDay}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

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
    {
      total: number;
      planned: number;
      inProgress: number;
      completed: number;
      teamIds: Set<string>;
    }
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
    else if (stage === "outreach_sent" || stage === "scheduled")
      entry.inProgress += 1;
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Admin dashboard</h1>
          <p className="text-sm text-neutral-500">
            Cross-team view of the full outreach pipeline.
          </p>
        </div>
        <form action="/admin/export" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="export-from" className="text-xs text-neutral-500">
              From
            </label>
            <Input
              id="export-from"
              name="from"
              type="date"
              className="h-8 w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="export-to" className="text-xs text-neutral-500">
              To
            </label>
            <Input id="export-to" name="to" type="date" className="h-8 w-36" />
          </div>
          <Button type="submit" variant="outline">
            Download Excel
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {byStage.map(({ stage, count }) => (
          <Card key={stage}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-neutral-500">
                {STAGE_LABELS[stage]}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {count}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team-wise leads</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminTeamBreakdown rows={teamActivity} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leads by day</CardTitle>
        </CardHeader>
        <CardContent>
          {byDay.length === 0 ? (
            <p className="text-sm text-neutral-500">No leads yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {byDay.map((row) => (
                <div key={row.day} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-neutral-500">
                    {formatDay(row.day)}
                  </span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-100">
                    <div
                      className="h-full rounded bg-[#0f62fe]"
                      style={{ width: `${(row.total / maxDayTotal) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-medium tabular-nums">
                    {row.total}
                  </span>
                </div>
              ))}
            </div>
          )}
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
                  <TableCell className="font-medium">
                    {region === "Unspecified" ? (
                      region
                    ) : (
                      <Link
                        href={`/admin/segment?region=${encodeURIComponent(region)}`}
                        className="hover:underline"
                      >
                        {region}
                      </Link>
                    )}
                  </TableCell>
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
                  <TableCell className="text-sm text-neutral-500">
                    {row.teams}
                  </TableCell>
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
