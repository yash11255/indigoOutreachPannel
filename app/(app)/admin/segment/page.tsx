import Link from "next/link";
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
import { AdminMemberBreakdown } from "@/components/admin-member-breakdown";
import { MemberInstitutionsList } from "@/components/member-institutions-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  stageForStatus,
  STAGE_ORDER,
  STAGE_LABELS,
  canEditLeads,
  buildMemberBreakdown,
  buildMemberInstitutions,
} from "@/lib/types";

function sum(nums: (number | null)[]) {
  return nums.reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

/** Builds a /admin/segment URL carrying forward whichever filters are set, plus one new one. */
function segmentHref(params: {
  region?: string;
  team?: string;
  subTeam?: string;
  state?: string;
  district?: string;
  date?: string;
}) {
  const sp = new URLSearchParams();
  if (params.region) sp.set("region", params.region);
  if (params.team) sp.set("team", params.team);
  if (params.subTeam) sp.set("subTeam", params.subTeam);
  if (params.state) sp.set("state", params.state);
  if (params.district) sp.set("district", params.district);
  if (params.date) sp.set("date", params.date);
  return `/admin/segment?${sp.toString()}`;
}

/** Same IST-day grouping used by the admin dashboard's "Leads by day" chart, so a day's bar and its drill-down agree on exactly which leads count as "that day". */
function createdOnDay(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatDay(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

/** Same as groupCount but keyed by team — kept separate since the link target needs the team's id, not just its name. */
function groupByTeam(
  leads: { team_id: string; status: string }[],
  teams: { id: string; name: string }[],
) {
  const map = new Map<string, { id: string; total: number; completed: number }>();
  for (const l of leads) {
    const team = teams.find((t) => t.id === l.team_id);
    const key = team?.name ?? "Unspecified";
    const entry = map.get(key) ?? { id: l.team_id, total: 0, completed: 0 };
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
  searchParams: Promise<{
    region?: string;
    team?: string;
    subTeam?: string;
    state?: string;
    district?: string;
    date?: string;
  }>;
}) {
  const profile = await requireAdminOrTeamAdmin();
  const isFullAdmin = profile.role === "admin";
  const { state, district, date } = await searchParams;
  let { region, team: teamId, subTeam } = await searchParams;

  // A team_admin only ever sees their own team — region rolls up multiple
  // teams, so it isn't a meaningful scope for them either. Force both rather
  // than erroring, so an edited/stale URL just lands them back on their team.
  // If they're also scoped to one sub-division (e.g. the IBM lead), force
  // that too rather than letting a query param widen it back to the whole
  // team. A whole-team team_admin (sub_team null) can still optionally drill
  // into a sub-team via the URL, same as a full admin can.
  if (!isFullAdmin) {
    region = undefined;
    teamId = profile.team_id ?? undefined;
    if (profile.sub_team) subTeam = profile.sub_team;
  }
  if (!region && !teamId && !subTeam && !state && !district && !date) notFound();

  const [allLeads, teams] = await Promise.all([getLeads(), getTeams()]);
  const team = teamId ? teams.find((t) => t.id === teamId) : undefined;
  if (teamId && !team) notFound();

  const leads = allLeads.filter(
    (l) =>
      (!region || l.region === region) &&
      (!teamId || l.team_id === teamId) &&
      (!subTeam || l.sub_team === subTeam) &&
      (!state || l.state === state) &&
      (!district || l.district_city === district) &&
      (!date || createdOnDay(l.created_at) === date),
  );

  const titleParts = [
    region,
    state,
    district,
    team?.name,
    subTeam,
    date && `Created ${formatDay(date)}`,
  ].filter(Boolean);
  const title = titleParts.join(" — ") || "All leads";

  // Who created what that day — the whole point of drilling into a date.
  const byCreator = date ? buildMemberBreakdown(leads, teams) : [];

  const stages = STAGE_ORDER.map((stage) => ({
    stage,
    count: leads.filter((l) => stageForStatus(l.status) === stage).length,
  }));

  // Skip a breakdown once already filtered down to a single value on that
  // same dimension — a "by state" table with one row isn't useful once
  // you've already drilled into that state.
  const byState = !state ? groupCount(leads, (l) => l.state) : [];
  const byDistrict = !district ? groupCount(leads, (l) => l.district_city) : [];
  const byTeam = !teamId ? groupByTeam(leads, teams) : [];
  const byMember = buildMemberInstitutions(leads);

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
        <form action="/admin/export" className="flex flex-wrap items-end gap-4">
          {region && <input type="hidden" name="region" value={region} />}
          {teamId && <input type="hidden" name="team" value={teamId} />}
          {subTeam && <input type="hidden" name="subTeam" value={subTeam} />}
          {state && <input type="hidden" name="state" value={state} />}
          {district && <input type="hidden" name="district" value={district} />}
          {date && <input type="hidden" name="createdOn" value={date} />}
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
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-500">Include sheets</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Label className="cursor-pointer font-normal">
                <input type="hidden" name="includeTeam" value="0" />
                <input type="checkbox" name="includeTeam" value="1" defaultChecked className="h-3.5 w-3.5" />
                Team
              </Label>
              <Label className="cursor-pointer font-normal">
                <input type="hidden" name="includeState" value="0" />
                <input type="checkbox" name="includeState" value="1" defaultChecked className="h-3.5 w-3.5" />
                State
              </Label>
              <Label className="cursor-pointer font-normal">
                <input type="hidden" name="includeDistrict" value="0" />
                <input type="checkbox" name="includeDistrict" value="1" defaultChecked className="h-3.5 w-3.5" />
                District
              </Label>
              <Label className="cursor-pointer font-normal">
                <input type="hidden" name="includeMember" value="0" />
                <input type="checkbox" name="includeMember" value="1" defaultChecked className="h-3.5 w-3.5" />
                Team member
              </Label>
            </div>
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

      {date && (
        <Card>
          <CardHeader>
            <CardTitle>Who created these</CardTitle>
          </CardHeader>
          <CardContent>
            {byCreator.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No leads created on this day match the current filters.
              </p>
            ) : (
              <AdminMemberBreakdown rows={byCreator} />
            )}
          </CardContent>
        </Card>
      )}

      {(byTeam.length > 0 || byState.length > 0 || byDistrict.length > 0) && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {byTeam.length > 0 && (
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byTeam.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">
                          {row.name === "Unspecified" ? (
                            row.name
                          ) : (
                            <Link
                              href={segmentHref({ region, team: row.id, state, district })}
                              className="hover:underline"
                            >
                              {row.name}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell>{row.completed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {byState.length > 0 && (
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
                        <TableCell className="font-medium">
                          {row.name === "Unspecified" ? (
                            row.name
                          ) : (
                            <Link
                              href={segmentHref({ region, team: teamId, subTeam, state: row.name })}
                              className="hover:underline"
                            >
                              {row.name}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell>{row.completed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {byDistrict.length > 0 && (
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
                        <TableCell className="font-medium">
                          {row.name === "Unspecified" ? (
                            row.name
                          ) : (
                            <Link
                              href={segmentHref({
                                region,
                                team: teamId,
                                subTeam,
                                state,
                                district: row.name,
                              })}
                              className="hover:underline"
                            >
                              {row.name}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell>{row.completed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>By team member</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberInstitutionsList
            groups={byMember}
            teams={teams}
            showTeamColumn={!teamId}
          />
        </CardContent>
      </Card>

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
