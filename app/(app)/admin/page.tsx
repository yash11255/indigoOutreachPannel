import Link from "next/link";
import { requireAdmin } from "@/lib/data/session";
import { getLeads } from "@/lib/data/leads";
import { getTeams } from "@/lib/data/lookups";
import { getAllProfiles } from "@/lib/data/admin";
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
import { AdminMemberBreakdown } from "@/components/admin-member-breakdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  stageForStatus,
  buildMemberBreakdown,
  type LeadStage,
} from "@/lib/types";

function sum(nums: (number | null)[]) {
  return nums.reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

export default async function AdminPage() {
  await requireAdmin();
  const [leads, teams, profiles] = await Promise.all([
    getLeads(),
    getTeams(),
    getAllProfiles(),
  ]);

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
          plannedDate: l.planned_date,
          executedDate: l.executed_date,
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

      const teamMembers = profiles
        .filter((p) => p.team_id === row.team.id)
        .map((p) => ({ name: p.full_name || p.email, email: p.email }));

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
        members: teamMembers,
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

  const byMember = buildMemberBreakdown(leads, teams);

  // Common one-click reports — each just points at /admin/export with a
  // different preset combination of the same sheet-toggle/stage/date params
  // the manual form already supports, so there's no separate export logic.
  const isoDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const quickDownloads: { label: string; href: string }[] = [
    { label: "Master Sheet (region + state + district + team + sub-team + all leads)", href: "/admin/export?report=master" },
    { label: "Everything (all sheets)", href: "/admin/export" },
    {
      label: "Team summary only",
      href: "/admin/export?includeState=0&includeDistrict=0&includeMember=0",
    },
    {
      label: "State summary only",
      href: "/admin/export?includeTeam=0&includeDistrict=0&includeMember=0",
    },
    {
      label: "District summary only",
      href: "/admin/export?includeTeam=0&includeState=0&includeMember=0",
    },
    {
      label: "Team member summary only",
      href: "/admin/export?includeTeam=0&includeState=0&includeDistrict=0",
    },
    {
      label: "Raw leads only (no summaries)",
      href: "/admin/export?includeTeam=0&includeState=0&includeDistrict=0&includeMember=0",
    },
    {
      label: "This week",
      href: `/admin/export?from=${isoDay(weekAgo)}&to=${isoDay(today)}`,
    },
    {
      label: "This month",
      href: `/admin/export?from=${isoDay(monthStart)}&to=${isoDay(today)}`,
    },
    { label: "Completed leads only", href: "/admin/export?stages=completed" },
    { label: "Planned (not started) only", href: "/admin/export?stages=planned" },
    {
      label: "In progress (sent + scheduled)",
      href: "/admin/export?stages=outreach_sent,scheduled",
    },
    {
      label: "Stalled (no response / rejected)",
      href: "/admin/export?stages=stalled",
    },
    {
      label: "Inactive users (never logged in)",
      href: "/admin/export?report=inactive",
    },
    {
      label: "Date x Team x Sub-team x Member x Institution x Stage",
      href: "/admin/export?groupBy=date&groupBy=team&groupBy=subTeam&groupBy=member&groupBy=institution&groupBy=stage",
    },
    {
      label: "Created Date x Team x Member x Email x Status",
      href: "/admin/export?groupBy=createdDate&groupBy=team&groupBy=member&groupBy=memberEmail&groupBy=status",
    },
    {
      label: "Full lead detail (date, team, SPOC, activity, status, location)",
      href:
        "/admin/export?" +
        [
          "institution",
          "createdDate",
          "team",
          "subTeam",
          "member",
          "memberEmail",
          "region",
          "state",
          "district",
          "contact",
          "mobile",
          "email",
          "plannedActivity",
          "activityUndertaken",
          "status",
        ]
          .map((c) => `columns=${c}`)
          .join("&"),
    },
  ];

  const dimensionOptions: { key: string; label: string }[] = [
    { key: "date", label: "Planned Date" },
    { key: "createdDate", label: "Created Date" },
    { key: "team", label: "Team" },
    { key: "subTeam", label: "Sub-team" },
    { key: "region", label: "Region" },
    { key: "state", label: "State" },
    { key: "district", label: "District / City" },
    { key: "member", label: "Team Member" },
    { key: "memberEmail", label: "Team Member Email" },
    { key: "institution", label: "Institution" },
    { key: "stage", label: "Stage" },
    { key: "status", label: "Status" },
  ];

  const columnOptions: { key: string; label: string }[] = [
    { key: "institution", label: "Institution" },
    { key: "createdDate", label: "Created date" },
    { key: "team", label: "Team" },
    { key: "subTeam", label: "Sub-team" },
    { key: "region", label: "Region" },
    { key: "state", label: "State" },
    { key: "district", label: "District / City" },
    { key: "hobli", label: "Hobli / Taluk" },
    { key: "pillar", label: "Outreach Pillar" },
    { key: "channel", label: "Outreach Channel" },
    { key: "mode", label: "Outreach Mode" },
    { key: "contact", label: "Contact person" },
    { key: "designation", label: "Designation" },
    { key: "mobile", label: "Mobile" },
    { key: "email", label: "Email" },
    { key: "member", label: "Responsible member" },
    { key: "memberEmail", label: "Team member email" },
    { key: "plannedActivity", label: "Planned activity" },
    { key: "plannedDate", label: "Planned date" },
    { key: "totalStudents", label: "Total students" },
    { key: "plannedGirls", label: "Planned girls reach" },
    { key: "executedDate", label: "Executed date" },
    { key: "activityUndertaken", label: "Activity undertaken" },
    { key: "girlsReached", label: "Girls reached" },
    { key: "status", label: "Status" },
    { key: "driveLink", label: "Drive link" },
    { key: "remarks", label: "Remarks" },
  ];

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

      <Card>
        <CardHeader>
          <CardTitle>Quick downloads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {quickDownloads.map((d) => (
              <a key={d.label} href={d.href}>
                <Button variant="outline" className="w-full justify-start text-sm">
                  {d.label}
                </Button>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Build a custom sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/admin/export" className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-xs font-medium text-neutral-600">
                Group by (any combination becomes one sheet, e.g. Team + Team
                Member gives one row per team/member pair)
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {dimensionOptions.map((d) => (
                  <Label key={d.key} className="cursor-pointer font-normal">
                    <input
                      type="checkbox"
                      name="groupBy"
                      value={d.key}
                      className="h-3.5 w-3.5"
                    />
                    {d.label}
                  </Label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-600">
                  Columns in the &quot;All leads&quot; sheet
                </p>
                <span className="text-xs text-neutral-400">
                  All checked by default — uncheck any you don&apos;t need
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4">
                {columnOptions.map((c) => (
                  <Label key={c.key} className="cursor-pointer font-normal">
                    <input
                      type="checkbox"
                      name="columns"
                      value={c.key}
                      defaultChecked
                      className="h-3.5 w-3.5"
                    />
                    {c.label}
                  </Label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="custom-from" className="text-xs text-neutral-500">
                  From
                </label>
                <Input id="custom-from" name="from" type="date" className="h-8 w-36" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="custom-to" className="text-xs text-neutral-500">
                  To
                </label>
                <Input id="custom-to" name="to" type="date" className="h-8 w-36" />
              </div>
              <Button type="submit">Build &amp; download</Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
                <Link
                  key={row.day}
                  href={`/admin/segment?date=${row.day}`}
                  className="flex items-center gap-3 text-sm hover:bg-neutral-50"
                >
                  <span className="w-24 shrink-0 text-neutral-500 hover:underline">
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
                </Link>
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
          <AdminMemberBreakdown rows={byMember} />
        </CardContent>
      </Card>
    </div>
  );
}
