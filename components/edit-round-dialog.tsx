"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateRound } from "@/lib/actions/leads";
import { OUTREACH_PHOTOS_FOLDER_URL } from "@/lib/outreach-taxonomy";
import type { StatusLookup } from "@/lib/types";
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

export type EditRoundInitial = {
  title: string | null;
  status: string;
  plannedDate: string | null;
  executedDate: string | null;
  totalStudents: number | null;
  plannedGirlsReach: number | null;
  girlsReached: number | null;
  activityUndertaken: string | null;
  driveLink: string | null;
  remarks: string | null;
};

/**
 * Directly edits a round's fields, available whether or not it's already
 * resolved — Reschedule/Mark as executed/Cancel only work once, on a round
 * still in progress, so this is the only way to fix a mistake after the fact.
 */
export function EditRoundDialog({
  roundId,
  leadId,
  title,
  statuses,
  initial,
  trigger,
}: {
  roundId: string;
  leadId: string;
  title: string;
  statuses: StatusLookup[];
  initial: EditRoundInitial;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [roundTitle, setRoundTitle] = useState(initial.title ?? "");
  const [status, setStatus] = useState(initial.status);
  const [plannedDate, setPlannedDate] = useState(initial.plannedDate ?? "");
  const [executedDate, setExecutedDate] = useState(initial.executedDate ?? "");
  const [totalStudents, setTotalStudents] = useState(
    initial.totalStudents?.toString() ?? "",
  );
  const [plannedGirlsReach, setPlannedGirlsReach] = useState(
    initial.plannedGirlsReach?.toString() ?? "",
  );
  const [girlsReached, setGirlsReached] = useState(
    initial.girlsReached?.toString() ?? "",
  );
  const [activityUndertaken, setActivityUndertaken] = useState(
    initial.activityUndertaken ?? "",
  );
  const [driveLink, setDriveLink] = useState(initial.driveLink ?? "");
  const [remarks, setRemarks] = useState(initial.remarks ?? "");

  function submit() {
    startTransition(async () => {
      try {
        await updateRound(roundId, leadId, {
          title: roundTitle || undefined,
          status,
          plannedDate: plannedDate || undefined,
          executedDate: executedDate || undefined,
          totalStudents: totalStudents ? Number(totalStudents) : undefined,
          plannedGirlsReach: plannedGirlsReach
            ? Number(plannedGirlsReach)
            : undefined,
          girlsReached: girlsReached ? Number(girlsReached) : undefined,
          activityUndertaken: activityUndertaken || undefined,
          driveLink: driveLink || undefined,
          remarks: remarks || undefined,
        });
        toast.success("Round updated");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update round");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="edit_round_title">Title</Label>
            <Input
              id="edit_round_title"
              value={roundTitle}
              onChange={(e) => setRoundTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit_round_status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v ?? status)}
            >
              <SelectTrigger id="edit_round_status">
                <SelectValue>{(value: string) => value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit_round_planned_date">Planned date</Label>
            <Input
              id="edit_round_planned_date"
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit_round_executed_date">Executed date</Label>
            <Input
              id="edit_round_executed_date"
              type="date"
              value={executedDate}
              onChange={(e) => setExecutedDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit_round_total_students">Total students</Label>
            <Input
              id="edit_round_total_students"
              type="number"
              inputMode="numeric"
              value={totalStudents}
              onChange={(e) => setTotalStudents(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit_round_planned_girls">
              Planned girls reach
            </Label>
            <Input
              id="edit_round_planned_girls"
              type="number"
              inputMode="numeric"
              value={plannedGirlsReach}
              onChange={(e) => setPlannedGirlsReach(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit_round_girls_reached">Girls reached</Label>
            <Input
              id="edit_round_girls_reached"
              type="number"
              inputMode="numeric"
              value={girlsReached}
              onChange={(e) => setGirlsReached(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="edit_round_activity">Activity undertaken</Label>
            <Input
              id="edit_round_activity"
              value={activityUndertaken}
              onChange={(e) => setActivityUndertaken(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit_round_drive_link">Google Drive link</Label>
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
              id="edit_round_drive_link"
              type="url"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="Paste the shareable link after uploading…"
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="edit_round_remarks">Remarks</Label>
            <Textarea
              id="edit_round_remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
