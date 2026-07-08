import { requireProfile } from "@/lib/data/session";
import { getUpcomingLeads } from "@/lib/data/leads";
import { getTeams } from "@/lib/data/lookups";
import { CalendarView } from "./calendar-view";
import type { CalEvent } from "@/components/calendar-month";

export default async function CalendarPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  // No team filter: RLS scopes rows to what this profile can see already.
  const [leads, teams] = await Promise.all([getUpcomingLeads(), getTeams()]);

  const events: CalEvent[] = [];
  for (const lead of leads) {
    if (lead.planned_date) events.push({ date: lead.planned_date, type: "planned", lead });
    if (lead.executed_date) events.push({ date: lead.executed_date, type: "executed", lead });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Calendar</h1>
        <p className="text-sm text-neutral-500">
          Every lead&apos;s planned and executed dates, across {isAdmin ? "all teams" : "your leads"}.
        </p>
      </div>
      <CalendarView events={events} teams={teams} isAdmin={isAdmin} />
    </div>
  );
}
