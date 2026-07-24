"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { MarkExecutedInput } from "@/lib/actions/leads";
import {
  OUTREACH_ACTIVITIES,
  OTHER_VALUE,
  OUTREACH_PHOTOS_FOLDER_URL,
  hasAwarenessSession,
} from "@/lib/outreach-taxonomy";
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
 * The planned -> execution transition for one round: requires an executed
 * date, and records that round's own outcome. Generic over "mark the lead
 * itself executed" vs. "mark a specific round executed" via the onConfirm
 * callback, since both follow the exact same shape.
 *
 * Marking a round executed here never by itself completes the whole lead —
 * the server only flips the lead to "Activity Completed" once every round is
 * resolved, a genuine awareness session (offline or online) has happened
 * somewhere in its history (this round's activity, or a prior one via
 * `priorSessionActivities`), AND contact details are on file. Without a
 * session it stays "Planned" even if nothing else is currently pending,
 * since more rounds may still be added. Closing a lead out early *without* a
 * session is a deliberate act via the Cancel action (Rejected/No Response),
 * not a side effect of routine execution.
 *
 * Missing contact details is treated differently from a missing session:
 * executing the actual session round while there's still no one to point to
 * as the contact is blocked outright, since a "completed" lead with nobody
 * recorded as spoken-to isn't a useful record — go add contact details on
 * the lead first, then come back and execute.
 */
export function MoveToExecutionDialog({
  title,
  initialExecutedDate,
  initialActivityUndertaken,
  initialGirlsReached,
  initialTotalStudents,
  initialDriveLink,
  priorSessionActivities,
  hasContactDetails,
  onConfirm,
  trigger,
}: {
  title: string;
  initialExecutedDate?: string | null;
  initialActivityUndertaken?: string | null;
  initialGirlsReached?: number | null;
  initialTotalStudents?: number | null;
  initialDriveLink?: string | null;
  /** Other rounds' activity_undertaken values for this same lead — if any of
   * them was already a genuine awareness session, this round doesn't need
   * to be one too. */
  priorSessionActivities?: (string | null)[];
  /** Whether this lead already has a contact person + mobile/email on file —
   * required (alongside a genuine session) before it can complete. */
  hasContactDetails?: boolean;
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

  const hadPriorSession = hasAwarenessSession(priorSessionActivities ?? []);
  const isSessionActivity = hasAwarenessSession([resolvedActivity]);
  const hadAwarenessSession = hadPriorSession || isSessionActivity;
  // Meetings/emails/flyers have no headcount to plan — only show these once
  // this round is a genuine session, or it already has saved numbers (so
  // reopening a partially-filled dialog never silently drops existing data).
  const showReachFields =
    isSessionActivity || initialTotalStudents != null || initialGirlsReached != null;
  const contactDetailsMissing = isSessionActivity && hasContactDetails === false;

  function submit() {
    if (!executedDate) {
      toast.error("Executed date is required to mark this as executed.");
      return;
    }
    if (contactDetailsMissing) {
      toast.error(
        "Add contact details (contact person + mobile/email) on this lead before this session round can complete it.",
      );
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
        toast.success("Marked as executed");
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
          {showReachFields ? (
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
          ) : (
            <p className="text-xs text-neutral-400">
              Total students / Girls reached only apply once this round is an
              awareness session.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="move_drive_link">Google Drive link</Label>
              <a
                href={OUTREACH_PHOTOS_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Upload photos here ↗
              </a>
            </div>
            <Input
              id="move_drive_link"
              type="url"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="Paste the shareable link after uploading…"
            />
          </div>

          {contactDetailsMissing && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">
                Add contact details (contact person + mobile or email) on
                this lead before this session round can complete it — close
                this, click Edit on the lead to add them, then come back and
                mark this executed.
              </p>
            </div>
          )}

          {!hadAwarenessSession && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                No awareness session recorded at this institution yet — this
                round will be marked done, but the lead stays open (not
                &quot;Activity Completed&quot;) until a real session happens
                in some round. Add the next round once you know it, or if
                nothing more is planned, cancel the lead as Rejected/No
                Response instead of leaving it open indefinitely.
              </p>
            </div>
          )}

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
            {hadAwarenessSession
              ? "This resolves the round. If every other round is also resolved and contact details are on file, the lead moves to \"Activity Completed\"."
              : "This resolves the round, but keeps the lead \"Planned\" since no awareness session is on record yet."}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || contactDetailsMissing}>
            {pending ? "Saving…" : "Mark as executed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
