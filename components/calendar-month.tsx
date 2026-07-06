"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stageForStatus, STAGE_LABELS, type LeadStage, type Lead, type Team } from "@/lib/types";

export type CalEvent = {
  date: string;
  type: "planned" | "executed";
  lead: Lead;
};

const STAGE_DOT: Record<LeadStage, string> = {
  planned: "bg-[#8d8d8d]",
  outreach_sent: "bg-[#0043ce]",
  scheduled: "bg-[#8a5300]",
  completed: "bg-[#0e6027]",
  stalled: "bg-[#a2191f]",
};

const STAGE_CHIP: Record<LeadStage, string> = {
  planned: "bg-[#e0e0e0] text-[#161616]",
  outreach_sent: "bg-[#edf5ff] text-[#0043ce]",
  scheduled: "bg-[#fcf4d6] text-[#8a5300]",
  completed: "bg-[#defbe6] text-[#0e6027]",
  stalled: "bg-[#fff1f1] text-[#a2191f]",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 3;

export function CalendarMonth({
  events,
  teams,
  isAdmin,
}: {
  events: CalEvent[];
  teams: Team[];
  isAdmin: boolean;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [openDay, setOpenDay] = useState<string | null>(null);

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date)!.push(ev);
    }
    return map;
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const openDayEvents = openDay ? (byDate.get(openDay) ?? []) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{format(month, "MMMM yyyy")}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth(subMonths(month, 1))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
            Next
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-t border-l border-[#d0d0d0]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="border-r border-b border-[#d0d0d0] bg-[#f4f4f4] px-2 py-1.5 text-xs font-medium text-neutral-500"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayEvents = byDate.get(dateStr) ?? [];
          const inMonth = isSameMonth(day, month);
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const overflow = dayEvents.length - visible.length;

          return (
            <div
              key={dateStr}
              className={`min-h-28 border-r border-b border-[#d0d0d0] p-1.5 ${
                inMonth ? "bg-white" : "bg-[#fafafa]"
              }`}
            >
              <div
                className={`mb-1 inline-flex h-5 w-5 items-center justify-center text-xs ${
                  isToday(day)
                    ? "bg-[#0f62fe] font-semibold text-white"
                    : inMonth
                      ? "text-neutral-700"
                      : "text-neutral-400"
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-1">
                {visible.map((ev, i) => {
                  const stage = stageForStatus(ev.lead.status);
                  return (
                    <Link
                      key={i}
                      href={`/leads/${ev.lead.id}`}
                      className={`flex items-center gap-1 truncate px-1 py-0.5 text-[11px] leading-tight ${STAGE_CHIP[stage]}`}
                      title={ev.lead.institution_name}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STAGE_DOT[stage]}`} />
                      <span className="truncate">{ev.lead.institution_name}</span>
                    </Link>
                  );
                })}
                {overflow > 0 && (
                  <button
                    onClick={() => setOpenDay(dateStr)}
                    className="px-1 text-left text-[11px] text-[#0f62fe] hover:underline"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={openDay !== null} onOpenChange={(open) => !open && setOpenDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {openDay ? format(parseISO(openDay), "MMMM d, yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {openDayEvents.map((ev, i) => {
              const stage = stageForStatus(ev.lead.status);
              return (
                <Link
                  key={i}
                  href={`/leads/${ev.lead.id}`}
                  className="flex items-center justify-between gap-2 border border-[#d0d0d0] p-2 text-sm hover:bg-[#f4f4f4]"
                >
                  <div>
                    <div className="font-medium">{ev.lead.institution_name}</div>
                    <div className="text-xs text-neutral-500">
                      {isAdmin ? `${teamName(ev.lead.team_id)} · ` : ""}
                      {[ev.lead.region, ev.lead.state].filter(Boolean).join(" / ")}
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 text-xs ${STAGE_CHIP[stage]}`}>
                    {STAGE_LABELS[stage]}
                  </span>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
