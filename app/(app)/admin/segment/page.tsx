import { notFound } from "next/navigation";
import { requireAdminOrTeamAdmin } from "@/lib/data/session";
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
import { LeadsTable } from "@/components/leads-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stageForStatus, STAGE_ORDER, STAGE_LABELS, canEditLeads } from "@/lib/types";

function sum(nums: (number | null)[]) {
  return nums.reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

function groupCount(
  leads: {
    region: string | null;
    state: string | null;
    district_city: string | null;
    status: string;
  }[],
  keyOf: (l: (typeof leads)[number]) => string | null,
) {
  const map = new Map<string, { total: number; completed: number }>();
  for (const l of leads) {
    const key = keyOf(l) || "Unspecified";
    const entry = map.get(key) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (stageForStatus(l.status) === "completed") entry.completed += 1;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total);
}

export default async function AdminSegmentPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; team?: string; subTeam?: string }>;
}) {
  const profile = await requireAdminOrTeamAdmin();
  const isFullAdmin = profile.role === "admin";
  const { subTeam } = await searchParams;
  let { region, team: teamId } = await searchParams;

  // A team_admin only ever sees their own team — region rolls up multiple
  // teams, so it isn't a meaningful scope for them either. Force both rather
  // than erroring, so an edited/stale URL just lands them back on their team.
  if (!isFullAdmin) {
    region = undefined;
    teamId = profile.team_id ?? undefined;
  }
  if (!region && !teamId && !subTeam) notFound();

  const [allLeads, teams] = await Promise.all([getLeads(), getTeams()]);
  const team = teamId ? teams.find((t) => t.id === teamId) : undefined;
  if (teamId && !team) notFound();

  const leads = allLeads.filter(
    (l) =>
      (!region || l.region === region) &&
      (!teamId || l.team_id === teamId) &&
      (!subTeam || l.sub_team === subTeam),
  );

  const titleParts = [region, team?.name, subTeam].filter(Boolean);
  const title = titleParts.join(" — ") || "All leads";

  const stages = STAGE_ORDER.map((stage) => ({
    stage,
    count: leads.filter((l) => stageForStatus(l.status) === stage).length,
  }));

  const byState = region ? groupCount(leads, (l) => l.state) : [];
  const byDistrict = region ? groupCount(leads, (l) => l.district_city) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-neutral-500">
            {leads.length} lead{leads.length === 1 ? "" : "s"} · girls reached{" "}
            {sum(leads.map((l) => l.girls_reached)).toLocaleString("en-IN")}
          </p>
        </div>
        <form action="/admin/export" className="flex flex-wrap items-end gap-2">
          {region && <input type="hidden" name="region" value={region} />}
          {teamId && <input type="hidden" name="team" value={teamId} />}
          {subTeam && <input type="hidden" name="subTeam" value={subTeam} />}
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
        {stages.map(({ stage, count }) => (
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

      {region && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By state</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead>Total leads</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byState.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{row.completed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By district / city</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>District / City</TableHead>
                    <TableHead>Total leads</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byDistrict.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{row.completed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadsTable
            leads={leads}
            teams={teams}
            showTeamColumn={!teamId}
            canEdit={canEditLeads(profile.role)}
            searchable
          />
        </CardContent>
      </Card>
    </div>
  );
}
