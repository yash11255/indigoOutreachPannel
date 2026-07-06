"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LeadsTable } from "@/components/leads-table";
import { LeadsKanban } from "@/components/leads-kanban";
import { LeadFormDialog } from "@/components/lead-form";
import { Button } from "@/components/ui/button";
import type { Lead, RegionState, StatusLookup, Team, DistrictMaster } from "@/lib/types";

export function LeadsView({
  leads,
  teams,
  statuses,
  regionsStates,
  districtsMaster,
  isAdmin,
  defaultTeamId,
  currentUserName,
}: {
  leads: Lead[];
  teams: Team[];
  statuses: StatusLookup[];
  regionsStates: RegionState[];
  districtsMaster: DistrictMaster[];
  isAdmin: boolean;
  defaultTeamId: string | null;
  currentUserName: string;
}) {
  const [view, setView] = useState("table");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>
        </Tabs>
        <LeadFormDialog
          mode="create"
          teams={teams}
          statuses={statuses}
          regionsStates={regionsStates}
          districtsMaster={districtsMaster}
          isAdmin={isAdmin}
          defaultTeamId={defaultTeamId}
          currentUserName={currentUserName}
          trigger={<Button>New lead</Button>}
        />
      </div>

      <Tabs value={view}>
        <TabsContent value="table">
          <LeadsTable leads={leads} teams={teams} showTeamColumn={isAdmin} />
        </TabsContent>
        <TabsContent value="kanban">
          <LeadsKanban leads={leads} teams={teams} showTeamLabel={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
