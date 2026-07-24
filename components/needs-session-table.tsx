"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reopenLead } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FlaggedLeadRow = {
  id: string;
  institution: string;
  team: string;
  subTeam: string | null;
  responsibleMember: string | null;
  executedDate: string | null;
  activityUndertaken: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function NeedsSessionTable({ rows }: { rows: FlaggedLeadRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reopenOne(id: string) {
    setReopeningId(id);
    startTransition(async () => {
      try {
        await reopenLead(id);
        toast.success("Lead reopened — back to Planned");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to reopen");
      } finally {
        setReopeningId(null);
      }
    });
  }

  function reopenSelected() {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Reopen ${selected.size} lead${selected.size === 1 ? "" : "s"}? They'll move back to Planned and lose their executed date.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        for (const id of selected) {
          await reopenLead(id, "Bulk-reopened — no genuine awareness session recorded.");
        }
        toast.success(`Reopened ${selected.size} lead(s)`);
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Some leads failed to reopen");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          {selected.size > 0 ? `${selected.size} selected` : `${rows.length} flagged`}
        </p>
        <Button
          size="sm"
          variant="destructive"
          disabled={selected.size === 0 || pending}
          onClick={reopenSelected}
        >
          {pending ? "Reopening…" : `Reopen selected (${selected.size})`}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Responsible member</TableHead>
              <TableHead>Executed date</TableHead>
              <TableHead>Logged as</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="bg-[#fff1f1]">
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    aria-label={`Select ${row.institution}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/leads/${row.id}`} className="hover:underline">
                    {row.institution}
                  </Link>
                </TableCell>
                <TableCell>
                  {row.team}
                  {row.subTeam && (
                    <span className="text-neutral-400"> / {row.subTeam}</span>
                  )}
                </TableCell>
                <TableCell>{row.responsibleMember ?? "—"}</TableCell>
                <TableCell>{formatDate(row.executedDate)}</TableCell>
                <TableCell className="max-w-xs truncate text-neutral-500">
                  {row.activityUndertaken || "(blank)"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => reopenOne(row.id)}
                  >
                    {reopeningId === row.id ? "Reopening…" : "Reopen"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
