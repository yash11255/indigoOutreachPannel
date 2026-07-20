"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MemberBreakdownRow } from "@/lib/types";

export type { MemberBreakdownRow };

export function AdminMemberBreakdown({ rows }: { rows: MemberBreakdownRow[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.member} ${r.teams}`.toLowerCase().includes(q),
    );
  }, [rows, deferredQuery]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search by member or team…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <p className="text-xs text-neutral-400">
          {filtered.length} of {rows.length} members
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Responsible member</TableHead>
            <TableHead>Team(s)</TableHead>
            <TableHead>Total leads</TableHead>
            <TableHead>Planned</TableHead>
            <TableHead>In progress</TableHead>
            <TableHead>Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.member}>
              <TableCell className="font-medium">{row.member}</TableCell>
              <TableCell className="text-sm text-neutral-500">
                {row.teams}
              </TableCell>
              <TableCell>{row.total}</TableCell>
              <TableCell>{row.planned}</TableCell>
              <TableCell>{row.inProgress}</TableCell>
              <TableCell>{row.completed}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-500">
          No members match &quot;{query}&quot;.
        </p>
      )}
    </div>
  );
}
