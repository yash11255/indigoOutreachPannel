"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/stage-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Team } from "@/lib/types";
import type { CalEvent } from "@/components/calendar-month";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function CalendarList({
  events,
  teams,
  isAdmin,
}: {
  events: CalEvent[];
  teams: Team[];
  isAdmin: boolean;
}) {
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";
  const today = todayISO();

  const grouped = new Map<string, CalEvent[]>();
  for (const ev of events) {
    if (!grouped.has(ev.date)) grouped.set(ev.date, []);
    grouped.get(ev.date)!.push(ev);
  }

  if (grouped.size === 0) {
    return <p className="py-10 text-center text-sm text-neutral-500">No dated leads yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(grouped.entries()).map(([date, dayEvents]) => {
        const isPast = date < today;
        const isToday = date === today;
        return (
          <div key={date} className="flex gap-4">
            <div className="w-28 shrink-0 pt-1 text-sm font-medium">
              {date}
              {isToday && (
                <Badge className="ml-2" variant="default">
                  Today
                </Badge>
              )}
              {isPast && !isToday && (
                <div className="text-xs font-normal text-[#da1e28]">overdue</div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {dayEvents.map((ev, i) => (
                <Card key={i} className="py-3">
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 px-4">
                    <div>
                      <Link href={`/leads/${ev.lead.id}`} className="font-medium hover:underline">
                        {ev.lead.institution_name}
                      </Link>
                      <div className="text-xs text-neutral-500">
                        {isAdmin ? `${teamName(ev.lead.team_id)} · ` : ""}
                        {[ev.lead.region, ev.lead.state].filter(Boolean).join(" / ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {ev.type === "planned" ? "Planned activity" : "Executed"}
                      </Badge>
                      <StatusBadge status={ev.lead.status} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
