"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { MarkExecutedInput } from "@/lib/actions/leads";
import { OUTREACH_ACTIVITIES, OTHER_VALUE } from "@/lib/outreach-taxonomy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * The planned -> execution transition: requires an executed date. Always
 * resolves to "Activity Completed" — no manual status pick. Generic over
 * "mark the lead itself executed" vs. "mark a specific round executed" via
 * the onConfirm callback, since both follow the exact same shape.
 */
export function MoveToExecutionDialog({
  title,
  initialExecutedDate,
  initialActivityUndertaken,
  initialGirlsReached,
  initialTotalStudents,
  initialDriveLink,
  onConfirm,
  trigger,
}: {
  title: string;
  initialExecutedDate?: string | null;
  initialActivityUndertaken?: string | null;
  initialGirlsReached?: number | null;
  initialTotalStudents?: number | null;
  initialDriveLink?: string | null;
  onConfirm: (input: MarkExecutedInput) => Promise<void>;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [executedDate, setExecutedDate] = useState(
    initialExecutedDate ?? new Date().toISOString().slice(0, 10),
  );

  const activityInitialIsOther =
    !!initialActivityUndertaken && !OUTREACH_ACTIVITIES.includes(initialActivityUndertaken);
  const [activityUndertaken, setActivityUndertaken] = useState(
    activityInitialIsOther ? OTHER_VALUE : (initialActivityUndertaken ?? ""),
  );
  const [activityOtherText, setActivityOtherText] = useState(
    activityInitialIsOther ? (initialActivityUndertaken ?? "") : "",
  );
  const activityIsOther = activityUndertaken === OTHER_VALUE;
  const resolvedActivity = activityIsOther ? activityOtherText : activityUndertaken;

  const [girlsReached, setGirlsReached] = useState(initialGirlsReached?.toString() ?? "");
  const [totalStudents, setTotalStudents] = useState(initialTotalStudents?.toString() ?? "");
  const [driveLink, setDriveLink] = useState(initialDriveLink ?? "");
  const [completionRemarks, setCompletionRemarks] = useState("");

  function submit() {
    if (!executedDate) {
      toast.error("Executed date is required to mark this as executed.");
      return;
    }
    startTransition(async () => {
      try {
        await onConfirm({
          executedDate,
          activityUndertaken: resolvedActivity || undefined,
          girlsReached: girlsReached ? Number(girlsReached) : undefined,
          totalStudents: totalStudents ? Number(totalStudents) : undefined,
          driveLink: driveLink || undefined,
          completionRemarks: completionRemarks || undefined,
        });
        toast.success("Marked as executed — completed");
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
          <DialogTitle>Mark as executed — {title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="move_executed_date">Executed date *</Label>
            <Input
              id="move_executed_date"
              type="date"
              value={executedDate}
              onChange={(e) => setExecutedDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="move_activity_undertaken">Activity undertaken</Label>
            <Select value={activityUndertaken} onValueChange={(v) => setActivityUndertaken(v ?? "")}>
              <SelectTrigger id="move_activity_undertaken">
                <SelectValue>
                  {(value: string) => {
                    if (!value) return "Select activity";
                    return value === OTHER_VALUE ? "Other (specify)" : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {OUTREACH_ACTIVITIES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_VALUE}>Other (specify)</SelectItem>
              </SelectContent>
            </Select>
            {activityIsOther && (
              <Input
                value={activityOtherText}
                onChange={(e) => setActivityOtherText(e.target.value)}
                placeholder="Specify…"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="move_total_students">Total students</Label>
              <Input
                id="move_total_students"
                type="number"
                inputMode="numeric"
                value={totalStudents}
                onChange={(e) => setTotalStudents(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="move_girls_reached">Girls reached</Label>
              <Input
                id="move_girls_reached"
                type="number"
                inputMode="numeric"
                value={girlsReached}
                onChange={(e) => setGirlsReached(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="move_drive_link">Google Drive link</Label>
            <Input
              id="move_drive_link"
              type="url"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="Link to session photos/evidence…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="move_completion_remarks">Completion remarks</Label>
            <Textarea
              id="move_completion_remarks"
              value={completionRemarks}
              onChange={(e) => setCompletionRemarks(e.target.value)}
              placeholder="How it went, any follow-up needed…"
            />
          </div>
          <p className="text-xs text-neutral-500">
            This will mark it as &quot;Activity Completed&quot;. If it didn&apos;t happen, close
            this and edit the status directly instead (e.g. Rejected, No Response).
          </p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Mark as executed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
