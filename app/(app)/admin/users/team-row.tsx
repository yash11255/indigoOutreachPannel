"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateTeam } from "@/lib/actions/admin";
import type { Team } from "@/lib/types";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TeamRow({ team }: { team: Team }) {
  const [name, setName] = useState(team.name);
  const [pending, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("team_id", team.id);
    fd.set("name", name);
    startTransition(async () => {
      try {
        await updateTeam(fd);
        toast.success("Team updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update team");
      }
    });
  }

  const dirty = name.trim() !== team.name && name.trim().length > 0;

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-xs"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
