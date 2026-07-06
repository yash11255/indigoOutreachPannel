"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addLeadUpdate } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Lets a team member log an interim outreach-update note against whichever
 * round is currently in progress — visible in the Progress card's update
 * log. Only shown while that round has no executed_date yet; once it's
 * marked executed the log for that round is closed.
 */
export function AddUpdateDialog({
  leadId,
  roundId,
  roundLabel,
  trigger,
}: {
  leadId: string;
  roundId: string | null;
  roundLabel: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  function submit() {
    if (!note.trim()) {
      toast.error("Update note is required.");
      return;
    }
    startTransition(async () => {
      try {
        await addLeadUpdate({ leadId, roundId, note });
        toast.success("Update added");
        setOpen(false);
        setNote("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add update");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add outreach update — {roundLabel}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="update_note">What&apos;s new</Label>
          <Textarea
            id="update_note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Called the principal, waiting on approval from district office…"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Adding…" : "Add update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
