"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarMonth, type CalEvent } from "@/components/calendar-month";
import { CalendarList } from "./calendar-list";
import type { Team } from "@/lib/types";

export function CalendarView({
  events,
  teams,
  isAdmin,
}: {
  events: CalEvent[];
  teams: Team[];
  isAdmin: boolean;
}) {
  const [view, setView] = useState("month");

  return (
    <Tabs value={view} onValueChange={setView}>
      <TabsList>
        <TabsTrigger value="month">Month</TabsTrigger>
        <TabsTrigger value="list">List</TabsTrigger>
      </TabsList>
      <TabsContent value="month">
        <CalendarMonth events={events} teams={teams} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="list">
        <CalendarList events={events} teams={teams} isAdmin={isAdmin} />
      </TabsContent>
    </Tabs>
  );
}
