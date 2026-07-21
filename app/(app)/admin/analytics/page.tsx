import { requireAdmin } from "@/lib/data/session";
import { getLeads } from "@/lib/data/leads";
import { getTeams, getDistrictsMaster } from "@/lib/data/lookups";
import { getAllProfiles } from "@/lib/data/admin";
import { findMatchingDistrict, normalizeStateName } from "@/lib/india-geo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminAnalytics, type AnalyticsData } from "@/components/admin-analytics";
import { STAGE_LABELS, STAGE_ORDER, stageForStatus, type LeadStage } from "@/lib/types";

function sum(nums: (number | null)[]) {
  return nums.reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

function emptyStages(): Record<LeadStage, number> {
  return { planned: 0, outreach_sent: 0, scheduled: 0, completed: 0, stalled: 0 };
}

/** Trend chart starts at May of the current year, per admin request. */
const TREND_START_MONTH = 4; // 0-indexed: April=3, May=4

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  const [leads, teams, profiles, districtsMaster] = await Promise.all([
    getLeads(),
    getTeams(),
    getAllProfiles(),
    getDistrictsMaster(),
  ]);

  const totalLeads = leads.length;
  const stageCounts = emptyStages();
  for (const l of leads) stageCounts[stageForStatus(l.status)] += 1;
  const completed = stageCounts.completed;
  const inProgress = stageCounts.outreach_sent + stageCounts.scheduled;
  const stalled = stageCounts.stalled;
  const plannedGirls = sum(leads.map((l) => l.planned_girls_reach));
  const girlsReached = sum(leads.map((l) => l.girls_reached));

  const turnaroundDays: number[] = [];
  for (const l of leads) {
    if (stageForStatus(l.status) !== "completed" || !l.executed_date) continue;
    const created = new Date(l.created_at);
    const executed = new Date(`${l.executed_date}T00:00:00`);
    const days = Math.round((executed.getTime() - created.getTime()) / 86400000);
    if (days >= 0) turnaroundDays.push(days);
  }
  const avgTurnaroundDays =
    turnaroundDays.length > 0
      ? Math.round(sum(turnaroundDays) / turnaroundDays.length)
      : null;

  const teamIdsWithLeads = new Set(leads.map((l) => l.team_id));
  const memberProfiles = profiles.filter((p) => p.role === "member");
  const createdByIds = new Set(leads.map((l) => l.created_by).filter(Boolean));
  const activeMembers = memberProfiles.filter((p) => createdByIds.has(p.id)).length;

  const kpis = {
    totalLeads,
    completed,
    completionRate: totalLeads > 0 ? Math.round((completed / totalLeads) * 100) : 0,
    inProgress,
    stalled,
    plannedGirls,
    girlsReached,
    girlsReachRate: plannedGirls > 0 ? Math.round((girlsReached / plannedGirls) * 100) : 0,
    activeTeams: teams.filter((t) => teamIdsWithLeads.has(t.id)).length,
    totalTeams: teams.length,
    activeMembers,
    totalMembers: memberProfiles.length,
    avgTurnaroundDays,
  };

  const stageDistribution = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    value: stageCounts[stage],
  }));

  const monthMap = new Map<string, { created: number; completed: number }>();
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), TREND_START_MONTH, 1);
  for (
    let d = startMonth;
    d <= now;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, { created: 0, completed: 0 });
  }
  for (const l of leads) {
    const createdMonth = new Date(l.created_at).toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    });
    const key = createdMonth.slice(0, 7);
    const entry = monthMap.get(key);
    if (entry) entry.created += 1;

    if (stageForStatus(l.status) === "completed" && l.executed_date) {
      const execKey = l.executed_date.slice(0, 7);
      const execEntry = monthMap.get(execKey);
      if (execEntry) execEntry.completed += 1;
    }
  }
  const monthlyTrend = Array.from(monthMap.entries()).map(([month, stats]) => ({
    month,
    label: new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    }),
    ...stats,
  }));

  const teamStages = teams
    .map((team) => {
      const teamLeads = leads.filter((l) => l.team_id === team.id);
      if (teamLeads.length === 0) return null;
      const stages = emptyStages();
      for (const l of teamLeads) stages[stageForStatus(l.status)] += 1;
      return { team: team.name, ...stages, total: teamLeads.length };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.total - a.total);

  const regionMap = new Map<string, number>();
  for (const l of leads) {
    const key = l.region?.trim() || "Unspecified";
    regionMap.set(key, (regionMap.get(key) ?? 0) + 1);
  }
  const regionTotals = Array.from(regionMap.entries())
    .map(([region, total]) => ({ region, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const memberMap = new Map<string, number>();
  for (const l of leads) {
    const key = l.responsible_member?.trim() || "Unassigned";
    memberMap.set(key, (memberMap.get(key) ?? 0) + 1);
  }
  const topMembers = Array.from(memberMap.entries())
    .map(([member, total]) => ({ member, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .reverse();

  const girlsReachByTeam = teams
    .map((team) => {
      const teamLeads = leads.filter((l) => l.team_id === team.id);
      const planned = sum(teamLeads.map((l) => l.planned_girls_reach));
      const reached = sum(teamLeads.map((l) => l.girls_reached));
      if (planned === 0 && reached === 0) return null;
      return { team: team.name, planned, reached };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const teamCompletion = teamStages.map((row) => ({
    team: row.team,
    rate: row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0,
  }));

  // Grouped by normalizeStateName (same helper the Map view uses) so spelling
  // variants of the same state ("UP" / "Uttar Pradesh" / "Uttar Pardesh")
  // don't fragment into separate bars; the display label is whichever raw
  // spelling was most common within that group.
  const stateGroups = new Map<string, { total: number; labels: Map<string, number> }>();
  for (const l of leads) {
    const raw = l.state?.trim() || "Unspecified";
    const key = raw === "Unspecified" ? raw : normalizeStateName(raw);
    const entry = stateGroups.get(key) ?? { total: 0, labels: new Map<string, number>() };
    entry.total += 1;
    entry.labels.set(raw, (entry.labels.get(raw) ?? 0) + 1);
    stateGroups.set(key, entry);
  }
  const stateTotals = Array.from(stateGroups.values())
    .map(({ total, labels }) => ({
      state: Array.from(labels.entries()).sort((a, b) => b[1] - a[1])[0][0],
      total,
    }))
    .sort((a, b) => b.total - a.total);

  const districtMap = new Map<string, number>();
  for (const l of leads) {
    const key = l.district_city?.trim() || "Unspecified";
    districtMap.set(key, (districtMap.get(key) ?? 0) + 1);
  }
  const districtTotals = Array.from(districtMap.entries())
    .map(([district, total]) => ({ district, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);
  const totalDistinctDistricts = districtMap.size;

  // Classify each lead's district against the NITI Aayog Aspirational
  // Districts reference (districts_master.is_aspirational), reusing the same
  // state-scoped fuzzy matcher the map view uses so free-text district_city
  // values ("Bangalore Urban" etc.) resolve to the official district name.
  const districtsByState = new Map<string, typeof districtsMaster>();
  for (const d of districtsMaster) {
    const key = d.state.trim();
    const arr = districtsByState.get(key) ?? [];
    arr.push(d);
    districtsByState.set(key, arr);
  }
  let aspirationalCount = 0;
  let nonAspirationalCount = 0;
  let unclassifiedCount = 0;
  const aspirationalDistrictMap = new Map<string, { state: string; total: number }>();
  for (const l of leads) {
    const candidates = l.state ? districtsByState.get(l.state.trim()) : undefined;
    const matchedName = candidates
      ? findMatchingDistrict(l.district_city, candidates.map((d) => d.district))
      : null;
    const matchedRow = matchedName
      ? candidates!.find((d) => d.district === matchedName)
      : null;
    if (!matchedRow) {
      unclassifiedCount += 1;
      continue;
    }
    if (matchedRow.is_aspirational) {
      aspirationalCount += 1;
      const key = `${matchedRow.state}::${matchedRow.district}`;
      const entry = aspirationalDistrictMap.get(key) ?? {
        state: matchedRow.state,
        total: 0,
      };
      entry.total += 1;
      aspirationalDistrictMap.set(key, entry);
    } else {
      nonAspirationalCount += 1;
    }
  }
  const aspirational = {
    aspirationalCount,
    nonAspirationalCount,
    unclassifiedCount,
    aspirationalRate:
      totalLeads > 0 ? Math.round((aspirationalCount / totalLeads) * 100) : 0,
    byDistrict: Array.from(aspirationalDistrictMap.entries())
      .map(([key, v]) => ({ district: key.split("::")[1], state: v.state, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20),
  };

  const memberActive = {
    active: kpis.activeMembers,
    inactive: kpis.totalMembers - kpis.activeMembers,
  };

  // "Due till now" mirrors the /leads page's due-banner definition (planned,
  // not yet executed, planned_date already passed). "Next 15 days" is the
  // forward-looking window the admin actually asked to see, day by day.
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const NEXT_DAYS = 15;
  const stillDue = leads.filter(
    (l) => l.planned_date !== null && l.executed_date === null,
  );
  const dueTillNow = stillDue.filter((l) => l.planned_date! < todayIso).length;

  const dayCountMap = new Map<string, number>();
  for (const l of stillDue) {
    if (l.planned_date! < todayIso) continue;
    dayCountMap.set(l.planned_date!, (dayCountMap.get(l.planned_date!) ?? 0) + 1);
  }
  let cumulative = 0;
  const upcoming15Days: { date: string; label: string; count: number; cumulative: number }[] =
    [];
  for (let i = 0; i < NEXT_DAYS; i++) {
    const d = new Date(`${todayIso}T00:00:00`);
    d.setDate(d.getDate() + i);
    const dateKey = d.toLocaleDateString("en-CA");
    const count = dayCountMap.get(dateKey) ?? 0;
    cumulative += count;
    upcoming15Days.push({
      date: dateKey,
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      count,
      cumulative,
    });
  }
  const upcomingPlanned15Days = cumulative;

  const data: AnalyticsData = {
    kpis: { ...kpis, dueTillNow, upcomingPlanned15Days },
    stageDistribution,
    monthlyTrend,
    upcoming15Days,
    teamStages,
    teamCompletion,
    regionTotals,
    stateTotals,
    districtTotals,
    totalDistinctDistricts,
    aspirational,
    topMembers,
    memberActive,
    girlsReachByTeam,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-neutral-500">
          KPIs and trends across the full outreach pipeline.
        </p>
      </div>

      {totalLeads === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No data yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-500">
            No leads have been created yet.
          </CardContent>
        </Card>
      ) : (
        <AdminAnalytics data={data} />
      )}
    </div>
  );
}
