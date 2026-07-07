"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rescheduleActivity } from "@/lib/actions/leads";
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

/**
 * Changes an activity's planned date — for when an institution reschedules
 * before it's happened. Logs the old -> new date as an outreach update so
 * there's a trail of it, rather than silently overwriting the date.
 */
export function RescheduleDialog({
  leadId,
  roundId,
  currentPlannedDate,
  title,
  trigger,
}: {
  leadId: string;
  roundId: string | null;
  currentPlannedDate: string | null;
  title: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [plannedDate, setPlannedDate] = useState(currentPlannedDate ?? "");

  function submit() {
    if (!plannedDate) {
      toast.error("Planned date is required.");
      return;
    }
    startTransition(async () => {
      try {
        await rescheduleActivity({ leadId, roundId, plannedDate });
        toast.success("Planned date updated");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to reschedule");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule — {title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reschedule_planned_date">New planned date *</Label>
          <Input
            id="reschedule_planned_date"
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
            required
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Update date"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
