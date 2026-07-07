"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createLeadRound } from "@/lib/actions/leads";
import { OUTREACH_ACTIVITIES, OTHER_VALUE } from "@/lib/outreach-taxonomy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function AddRoundDialog({ leadId, trigger }: { leadId: string; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [activity, setActivity] = useState("");
  const [activityOtherText, setActivityOtherText] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [totalStudents, setTotalStudents] = useState("");
  const [totalGirls, setTotalGirls] = useState("");

  const activityIsOther = activity === OTHER_VALUE;
  const resolvedActivity = activityIsOther ? activityOtherText : activity;

  function submit() {
    if (!plannedDate) {
      toast.error("Planned date is required.");
      return;
    }
    startTransition(async () => {
      try {
        await createLeadRound({
          leadId,
          title: resolvedActivity || undefined,
          plannedDate,
          totalStudents: totalStudents ? Number(totalStudents) : undefined,
          totalGirls: totalGirls ? Number(totalGirls) : undefined,
        });
        toast.success("Round added");
        setOpen(false);
        setActivity("");
        setActivityOtherText("");
        setPlannedDate("");
        setTotalStudents("");
        setTotalGirls("");
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
            <Label htmlFor="round_activity">Outreach Activity</Label>
            <Select value={activity} onValueChange={(v) => setActivity(v ?? "")}>
              <SelectTrigger id="round_activity">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="round_total_students">Total students</Label>
              <Input
                id="round_total_students"
                type="number"
                inputMode="numeric"
                value={totalStudents}
                onChange={(e) => setTotalStudents(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="round_total_girls">Total girls</Label>
              <Input
                id="round_total_girls"
                type="number"
                inputMode="numeric"
                value={totalGirls}
                onChange={(e) => setTotalGirls(e.target.value)}
              />
            </div>
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
