"use client";

import { useMemo, useState } from "react";
import type { Team } from "@/lib/types";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeamRow } from "./team-row";

export function SearchableTeamsTable({ teams }: { teams: Team[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, query]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search teams…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <p className="text-xs text-neutral-400">
          {filtered.length} of {teams.length} teams
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Save</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((t) => (
            <TeamRow key={t.id} team={t} />
          ))}
        </TableBody>
      </Table>
      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-500">
          No teams match &quot;{query}&quot;.
        </p>
      )}
    </div>
  );
}
