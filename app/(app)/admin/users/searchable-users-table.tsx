"use client";

import { useMemo, useState } from "react";
import type { Profile, Team } from "@/lib/types";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MemberRow } from "./member-row";

export function SearchableUsersTable({
  profiles,
  teams,
  subTeamsByTeam,
  homeTeams,
}: {
  profiles: Profile[];
  teams: Team[];
  subTeamsByTeam: Record<string, string[]>;
  homeTeams: string[];
}) {
  const [query, setQuery] = useState("");

  const teamName = (id: string | null) =>
    teams.find((t) => t.id === id)?.name ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      [p.full_name, p.email, p.home_team, teamName(p.team_id), p.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, query, teams]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search by name, email, home team, or outreach team…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <p className="text-xs text-neutral-400">
          {filtered.length} of {profiles.length} users
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Home team</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Outreach team</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead>Secondary manager</TableHead>
            <TableHead className="text-right">Save</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => (
            <MemberRow
              key={p.id}
              profile={p}
              teams={teams}
              allProfiles={profiles}
              subTeamsByTeam={subTeamsByTeam}
              homeTeams={homeTeams}
            />
          ))}
        </TableBody>
      </Table>
      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-500">
          No users match &quot;{query}&quot;.
        </p>
      )}
    </div>
  );
}
