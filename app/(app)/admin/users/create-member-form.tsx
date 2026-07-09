"use client";

import { useActionState, useState } from "react";
import { createMember, type CreateMemberState } from "@/lib/actions/admin";
import { ROLE_LABELS, type Role, type Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: CreateMemberState = {};

export function CreateMemberForm({ teams }: { teams: Team[] }) {
  const [state, formAction, pending] = useActionState(createMember, initialState);
  const [role, setRole] = useState<Role>("member");
  const [teamId, setTeamId] = useState("");
  const needsTeam = role === "member" || role === "team_admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create teammate login</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole((v as Role) ?? "member")}>
              <SelectTrigger>
                <SelectValue>{(value: string) => ROLE_LABELS[value as Role]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="team_admin">{ROLE_LABELS.team_admin}</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="role" value={role} />
            {role === "team_admin" && (
              <p className="text-xs text-neutral-500">
                Can see every lead on their one team, but can&apos;t create, edit, or execute anything.
              </p>
            )}
          </div>
          {needsTeam && (
            <div className="flex flex-col gap-2">
              <Label>Outreach team</Label>
              <Select value={teamId} onValueChange={(v) => setTeamId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue>
                    {(value: string) =>
                      !value ? "Select team" : (teams.find((t) => t.id === value)?.name ?? "Select team")
                    }
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
              <input type="hidden" name="team_id" value={teamId} />
            </div>
          )}

          {state.error && <p className="sm:col-span-2 text-sm text-[#da1e28]">{state.error}</p>}
          {state.success && state.tempPassword && (
            <p className="sm:col-span-2 border border-[#a7f0ba] bg-[#defbe6] p-3 text-sm text-[#0e6027]">
              Account created. Temporary password (share this with them once — it won&apos;t be
              shown again): <span className="font-mono font-semibold">{state.tempPassword}</span>
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create login"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
