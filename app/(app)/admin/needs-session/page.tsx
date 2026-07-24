import { requireAdmin } from "@/lib/data/session";
import { getLeads, getAllLeadRounds } from "@/lib/data/leads";
import { getTeams } from "@/lib/data/lookups";
import { hasAwarenessSession } from "@/lib/outreach-taxonomy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NeedsSessionTable,
  type FlaggedLeadRow,
} from "@/components/needs-session-table";

export default async function NeedsSessionPage() {
  await requireAdmin();
  const [leads, rounds, teams] = await Promise.all([
    getLeads(),
    getAllLeadRounds(),
    getTeams(),
  ]);

  const roundsByLead = new Map<string, string[]>();
  for (const r of rounds) {
    const arr = roundsByLead.get(r.lead_id) ?? [];
    if (r.activity_undertaken) arr.push(r.activity_undertaken);
    roundsByLead.set(r.lead_id, arr);
  }

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";

  const flagged: FlaggedLeadRow[] = leads
    .filter((l) => l.status === "Activity Completed" || l.status === "Closed")
    .filter((l) => {
      const activities = [l.activity_undertaken, ...(roundsByLead.get(l.id) ?? [])];
      return !hasAwarenessSession(activities);
    })
    .map((l) => ({
      id: l.id,
      institution: l.institution_name,
      team: teamName(l.team_id),
      subTeam: l.sub_team,
      responsibleMember: l.responsible_member,
      executedDate: l.executed_date,
      activityUndertaken: l.activity_undertaken,
    }))
    .sort((a, b) => a.institution.localeCompare(b.institution));

  const totalCompleted = leads.filter(
    (l) => l.status === "Activity Completed" || l.status === "Closed",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Leads needing a real session</h1>
        <p className="text-sm text-neutral-500">
          Marked &quot;Activity Completed&quot; but no genuine awareness session
          (offline or online) is recorded anywhere in the lead&apos;s history —
          just a flyer, email, call, or meeting. Reopen these to redo with a
          proper session.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-neutral-50 px-3.5 py-2">
          <div className="text-xs text-neutral-500">Total completed</div>
          <div className="text-lg font-semibold tabular-nums">{totalCompleted}</div>
        </div>
        <div className="relative overflow-hidden rounded-md border bg-neutral-50 px-3.5 py-2">
          <div className="absolute inset-y-0 left-0 w-1 bg-[#da1e28]" aria-hidden />
          <div className="text-xs text-neutral-500">Missing a real session</div>
          <div className="text-lg font-semibold tabular-nums text-[#da1e28]">
            {flagged.length}
          </div>
        </div>
        <div className="rounded-md border bg-neutral-50 px-3.5 py-2">
          <div className="text-xs text-neutral-500">Have a genuine session</div>
          <div className="text-lg font-semibold tabular-nums">
            {totalCompleted - flagged.length}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flagged leads</CardTitle>
        </CardHeader>
        <CardContent>
          {flagged.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nothing flagged — every completed lead has a genuine session on record.
            </p>
          ) : (
            <NeedsSessionTable rows={flagged} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
