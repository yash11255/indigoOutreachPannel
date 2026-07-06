"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createLeadRound } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export function AddRoundDialog({ leadId, trigger }: { leadId: string; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [plannedDate, setPlannedDate] = useState("");

  function submit() {
    if (!plannedDate) {
      toast.error("Planned date is required.");
      return;
    }
    startTransition(async () => {
      try {
        await createLeadRound({ leadId, title: title || undefined, plannedDate });
        toast.success("Round added");
        setOpen(false);
        setTitle("");
        setPlannedDate("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add round");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add another round</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="round_title">Title</Label>
            <Input
              id="round_title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Follow-up visit, Final signup drive…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="round_planned_date">Planned date *</Label>
            <Input
              id="round_planned_date"
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Adding…" : "Add round"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
