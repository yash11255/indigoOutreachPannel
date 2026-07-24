"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
 * The manual completion path for a lead whose session was genuinely
 * attempted but rejected/cancelled — no photo evidence to require here since
 * nothing actually happened, unlike a genuinely-held session.
 */
export function CompleteDespiteRejectionDialog({
  title,
  hasContactDetails,
  onConfirm,
  trigger,
}: {
  title: string;
  /** Same rule as executing a session: contact details need to be on file
   * before this can go through — but the button itself stays clickable so
   * the block is discoverable rather than the option just disappearing. */
  hasContactDetails: boolean;
  onConfirm: (remarks?: string) => Promise<void>;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [remarks, setRemarks] = useState("");

  function submit() {
    if (!hasContactDetails) {
      toast.error(
        "Add contact details (contact person + mobile/email) on this lead before it can be marked completed.",
      );
      return;
    }
    startTransition(async () => {
      try {
        await onConfirm(remarks || undefined);
        toast.success("Lead marked as Completed");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to complete this lead");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Completed — {title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            A session was planned for this institution but got rejected or
            cancelled before it could happen. Real effort was made toward
            the actual goal, so this counts as done — no photo evidence
            needed since nothing was actually held.
          </p>
          {!hasContactDetails && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">
                Add contact details (contact person + mobile or email) on
                this lead before it can be marked completed — close this,
                click Edit on the lead to add them, then come back.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="complete_remarks">Remarks</Label>
            <Textarea
              id="complete_remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="What happened, why it didn't go ahead…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !hasContactDetails}>
            {pending ? "Saving…" : "Mark as Completed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
