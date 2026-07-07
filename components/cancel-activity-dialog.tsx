"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CANCEL_STATUSES, type CancelInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Marks an activity (a lead itself, or one of its rounds) as not happening —
 * the opposite outcome to "Mark as executed". Generic over lead vs. round
 * via the onConfirm callback, same pattern as MoveToExecutionDialog.
 */
export function CancelActivityDialog({
  title,
  onConfirm,
  trigger,
}: {
  title: string;
  onConfirm: (input: CancelInput) => Promise<void>;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>(CANCEL_STATUSES[0]);
  const [remarks, setRemarks] = useState("");

  function submit() {
    startTransition(async () => {
      try {
        await onConfirm({ status: status as CancelInput["status"], remarks: remarks || undefined });
        toast.success("Marked as " + status);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel — {title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cancel_status">Reason</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? CANCEL_STATUSES[0])}>
              <SelectTrigger id="cancel_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANCEL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cancel_remarks">Remarks</Label>
            <Textarea
              id="cancel_remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="What happened…"
            />
          </div>
          <p className="text-xs text-neutral-500">
            This won&apos;t set an executed date — it just marks this activity as not
            going ahead.
          </p>
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Confirm cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
