"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { createTeam, type CreateTeamState } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: CreateTeamState = {};

export function CreateTeamForm() {
  const [state, formAction, pending] = useActionState(createTeam, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      toast.success("Team created");
    }
    // Depends on the whole `state` object (not state.success) so this
    // re-fires on every new successful submission, not just the first —
    // useActionState returns a fresh object each dispatch, even when
    // `success` is true both times in a row.
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a team</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="team_name">Team name</Label>
            <Input id="team_name" name="name" placeholder="e.g. Adobe" required />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create team"}
          </Button>
        </form>
        {state.error && <p className="mt-2 text-sm text-[#da1e28]">{state.error}</p>}
        <p className="mt-2 text-xs text-neutral-400">
          New teams start empty — assign people to it below by editing their row and picking it
          from the Team dropdown.
        </p>
      </CardContent>
    </Card>
  );
}
