"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMember } from "@/lib/actions/admin";
import { ROLE_LABELS, type Profile, type Team } from "@/lib/types";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const NO_MANAGER = "__none__";
const WHOLE_TEAM = "__whole_team__";
const NO_HOME_TEAM = "__none__";
const OTHER_HOME_TEAM = "__other__";

export function MemberRow({
  profile,
  teams,
  allProfiles,
  subTeamsByTeam,
  homeTeams,
}: {
  profile: Profile;
  teams: Team[];
  allProfiles: Profile[];
  subTeamsByTeam: Record<string, string[]>;
  homeTeams: string[];
}) {
  const [role, setRole] = useState(profile.role);
  const [homeTeam, setHomeTeam] = useState(profile.home_team ?? "");
  const [homeTeamIsOther, setHomeTeamIsOther] = useState(
    !!profile.home_team && !homeTeams.includes(profile.home_team),
  );
  const [teamId, setTeamId] = useState(profile.team_id ?? "");
  const [subTeam, setSubTeam] = useState(profile.sub_team ?? "");
  const [managerId, setManagerId] = useState(profile.manager_id ?? "");
  const [pending, startTransition] = useTransition();
  const subTeamOptions = subTeamsByTeam[teamId] ?? [];

  function save() {
    const fd = new FormData();
    fd.set("user_id", profile.id);
    fd.set("role", role);
    fd.set("home_team", homeTeam);
    fd.set("team_id", teamId);
    fd.set("sub_team", subTeam);
    fd.set("manager_id", managerId);
    startTransition(async () => {
      try {
        await updateMember(fd);
        toast.success("Updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }

  const dirty =
    role !== profile.role ||
    homeTeam !== (profile.home_team ?? "") ||
    teamId !== (profile.team_id ?? "") ||
    subTeam !== (profile.sub_team ?? "") ||
    managerId !== (profile.manager_id ?? "");

  const managerCandidates = allProfiles
    .filter((p) => p.id !== profile.id)
    .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));

  return (
    <TableRow>
      <TableCell className="font-medium">{profile.full_name || "—"}</TableCell>
      <TableCell>{profile.email}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1.5">
          <Select
            value={homeTeamIsOther ? OTHER_HOME_TEAM : homeTeam || NO_HOME_TEAM}
            onValueChange={(v) => {
              if (v === OTHER_HOME_TEAM) {
                setHomeTeamIsOther(true);
              } else {
                setHomeTeamIsOther(false);
                setHomeTeam(!v || v === NO_HOME_TEAM ? "" : v);
              }
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                {(value: string) => {
                  if (value === OTHER_HOME_TEAM) return "Other (specify)";
                  if (!value || value === NO_HOME_TEAM) return "—";
                  return value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_HOME_TEAM}>—</SelectItem>
              {homeTeams.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_HOME_TEAM}>Other (specify)</SelectItem>
            </SelectContent>
          </Select>
          {homeTeamIsOther && (
            <Input
              className="h-8 w-40"
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              placeholder="Specify…"
            />
          )}
        </div>
      </TableCell>
      <TableCell>
        <Select value={role} onValueChange={(v) => setRole((v ?? "member") as Profile["role"])}>
          <SelectTrigger className="w-40">
            <SelectValue>{(value: string) => ROLE_LABELS[value as Profile["role"]]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="team_admin">{ROLE_LABELS.team_admin}</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {role === "member" || role === "team_admin" ? (
          <div className="flex flex-col gap-1.5">
            <Select
              value={teamId}
              onValueChange={(v) => {
                setTeamId(v ?? "");
                setSubTeam("");
              }}
            >
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
            {role === "team_admin" && teamId && subTeamOptions.length > 0 && (
              <Select
                value={subTeam || WHOLE_TEAM}
                onValueChange={(v) => setSubTeam(!v || v === WHOLE_TEAM ? "" : v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue>
                    {(value: string) => (value === WHOLE_TEAM ? "Whole team" : value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WHOLE_TEAM}>Whole team</SelectItem>
                  {subTeamOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          <span className="text-sm text-neutral-400">All teams</span>
        )}
      </TableCell>
      <TableCell>
        <Select
          value={managerId || NO_MANAGER}
          onValueChange={(v) => setManagerId(!v || v === NO_MANAGER ? "" : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              {(value: string) => {
                if (!value || value === NO_MANAGER) return "No manager";
                const m = allProfiles.find((p) => p.id === value);
                return m ? (m.full_name ?? m.email) : "No manager";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_MANAGER}>No manager</SelectItem>
            {managerCandidates.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
