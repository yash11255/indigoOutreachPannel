"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMember } from "@/lib/actions/admin";
import type { Profile, Team } from "@/lib/types";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function MemberRow({ profile, teams }: { profile: Profile; teams: Team[] }) {
  const [role, setRole] = useState(profile.role);
  const [teamId, setTeamId] = useState(profile.team_id ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("user_id", profile.id);
    fd.set("role", role);
    fd.set("team_id", teamId);
    startTransition(async () => {
      try {
        await updateMember(fd);
        toast.success("Updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }

  const dirty = role !== profile.role || teamId !== (profile.team_id ?? "");

  return (
    <TableRow>
      <TableCell className="font-medium">{profile.full_name || "—"}</TableCell>
      <TableCell>{profile.email}</TableCell>
      <TableCell>
        <Select value={role} onValueChange={(v) => setRole((v ?? "member") as Profile["role"])}>
          <SelectTrigger className="w-32">
            <SelectValue>{(value: string) => (value === "admin" ? "Admin" : "Member")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {role === "member" ? (
          <Select value={teamId} onValueChange={(v) => setTeamId(v ?? "")}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="No team">
                {(value: string) => teams.find((t) => t.id === value)?.name ?? "No team"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-neutral-400">All teams</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
