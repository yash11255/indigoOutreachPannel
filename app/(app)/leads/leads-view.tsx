"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LeadsTable } from "@/components/leads-table";
import { LeadsKanban } from "@/components/leads-kanban";
import { LeadFormDialog } from "@/components/lead-form";
import { AdminMemberBreakdown } from "@/components/admin-member-breakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildMemberBreakdown,
  canEditLeads,
  type Lead,
  type RegionState,
  type StatusLookup,
  type Team,
  type DistrictMaster,
  type Role,
} from "@/lib/types";

type SortOrder = "planned_desc" | "planned_asc" | "name_asc" | "name_desc";

const SORT_LABELS: Record<SortOrder, string> = {
  planned_desc: "Planned date: newest first",
  planned_asc: "Planned date: oldest first",
  name_asc: "Institution: A → Z",
  name_desc: "Institution: Z → A",
};

export function LeadsView({
  leads,
  teams,
  statuses,
  regionsStates,
  districtsMaster,
  role,
  defaultTeamId,
  currentUserName,
}: {
  leads: Lead[];
  teams: Team[];
  statuses: StatusLookup[];
  regionsStates: RegionState[];
  districtsMaster: DistrictMaster[];
  role: Role;
  defaultTeamId: string | null;
  currentUserName: string;
}) {
  const isAdmin = role === "admin";
  const canEdit = canEditLeads(role);
  const [view, setView] = useState("table");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOrder>("planned_desc");

  // Grouped by responsible_member so a manager (leads include their reports'
  // via RLS), a team_admin (sees their whole team), or a regular member once
  // teammates' imported leads become team-visible can see who owns what —
  // not just a flat list. Full admins already get this on /admin, so skip it
  // here to avoid showing the same table twice.
  const memberBreakdown = useMemo(
    () => buildMemberBreakdown(leads, teams),
    [leads, teams],
  );
  const showMemberBreakdown = !isAdmin && memberBreakdown.length > 1;

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? leads.filter((l) =>
          [l.institution_name, l.responsible_member, l.district_city, l.state, l.region]
            .some((field) => field?.toLowerCase().includes(q)),
        )
      : leads;

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "planned_asc":
          return (a.planned_date ?? "").localeCompare(b.planned_date ?? "");
        case "name_asc":
          return a.institution_name.localeCompare(b.institution_name);
        case "name_desc":
          return b.institution_name.localeCompare(a.institution_name);
        case "planned_desc":
        default:
          return (b.planned_date ?? "").localeCompare(a.planned_date ?? "");
      }
    });
  }, [leads, search, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>
        </Tabs>
        {canEdit && (
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
        )}
      </div>

      {showMemberBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Team members</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminMemberBreakdown rows={memberBreakdown} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by institution, member, district, state…"
          className="sm:max-w-xs"
        />
        <Select value={sort} onValueChange={(v) => setSort((v as SortOrder) ?? "planned_desc")}>
          <SelectTrigger className="sm:w-56">
            <SelectValue>{(value: string) => SORT_LABELS[value as SortOrder]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortOrder[]).map((key) => (
              <SelectItem key={key} value={key}>
                {SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {search && (
          <span className="text-xs text-neutral-400">
            {visibleLeads.length} of {leads.length} leads
          </span>
        )}
      </div>

      <Tabs value={view}>
        <TabsContent value="table">
          <LeadsTable
            leads={visibleLeads}
            teams={teams}
            showTeamColumn={isAdmin}
            canEdit={canEdit}
          />
        </TabsContent>
        <TabsContent value="kanban">
          <LeadsKanban
            leads={visibleLeads}
            teams={teams}
            showTeamLabel={isAdmin}
            canEdit={canEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
