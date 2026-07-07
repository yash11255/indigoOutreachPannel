"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { createLead, updateLead, type LeadFormState } from "@/lib/actions/leads";
import type { Lead, RegionState, StatusLookup, Team, DistrictMaster } from "@/lib/types";
import { findMatchingDistrict } from "@/lib/india-geo";
import {
  OUTREACH_PILLARS,
  PILLAR_CHANNELS,
  OUTREACH_MODES,
  OUTREACH_ACTIVITIES,
  OTHER_VALUE,
} from "@/lib/outreach-taxonomy";
import { SelectWithOther } from "@/components/select-with-other";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

const initialState: LeadFormState = {};

export function LeadFormDialog({
  mode,
  lead,
  teams,
  statuses,
  regionsStates,
  districtsMaster,
  isAdmin,
  defaultTeamId,
  currentUserName,
  trigger,
}: {
  mode: "create" | "edit";
  lead?: Lead;
  teams: Team[];
  statuses: StatusLookup[];
  regionsStates: RegionState[];
  districtsMaster: DistrictMaster[];
  isAdmin: boolean;
  defaultTeamId: string | null;
  /** The logged-in user's display name — auto-fills "Responsible member" for members creating their own leads. */
  currentUserName: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const action = mode === "create" ? createLead : updateLead.bind(null, lead!.id);
  const [state, formAction, pending] = useActionState(action, initialState);

  const [region, setRegion] = useState(lead?.region ?? "");
  const [state_, setState_] = useState(lead?.state ?? "");
  const [status, setStatus] = useState(lead?.status ?? "Planned");
  const [teamId, setTeamId] = useState(lead?.team_id ?? defaultTeamId ?? "");
  const [pillar, setPillar] = useState(lead?.institution_type ?? "");

  const districtsForState = useMemo(
    () => districtsMaster.filter((d) => d.state === state_).map((d) => d.district),
    [districtsMaster, state_],
  );
  const districtInitialIsOther =
    !!lead?.district_city && !districtsForState.includes(lead.district_city);
  const [district, setDistrict] = useState(
    districtInitialIsOther ? OTHER_VALUE : (lead?.district_city ?? ""),
  );
  const [districtOtherText, setDistrictOtherText] = useState(
    districtInitialIsOther ? (lead?.district_city ?? "") : "",
  );
  const districtIsOther = district === OTHER_VALUE;
  const resolvedDistrict = districtIsOther ? districtOtherText : district;

  const aspirational = useMemo(() => {
    if (!state_ || !resolvedDistrict) return null;
    const candidates = districtsMaster.filter((d) => d.state === state_);
    const matchName = findMatchingDistrict(resolvedDistrict, candidates.map((d) => d.district));
    if (!matchName) return null;
    return candidates.find((d) => d.district === matchName) ?? null;
  }, [state_, resolvedDistrict, districtsMaster]);

  const channelsForPillar = pillar && PILLAR_CHANNELS[pillar] ? PILLAR_CHANNELS[pillar] : [];

  const regions = useMemo(
    () => Array.from(new Set(regionsStates.map((r) => r.region))),
    [regionsStates],
  );
  const statesForRegion = useMemo(
    () => regionsStates.filter((r) => r.region === region),
    [regionsStates, region],
  );

  if (state.success && open) {
    setOpen(false);
    toast.success(mode === "create" ? "Lead created" : "Lead updated");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New lead" : "Edit lead"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isAdmin && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={(v) => setTeamId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team">
                    {(value: string) => teams.find((t) => t.id === value)?.name ?? "Select team"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="team_id" value={teamId} />
            </div>
          )}

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="institution_name">Institution name *</Label>
            <Input
              id="institution_name"
              name="institution_name"
              defaultValue={lead?.institution_name}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Region</Label>
            <Select value={region} onValueChange={(v) => { setRegion(v ?? ""); setState_(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="region" value={region} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>State</Label>
            <Select
              value={state_}
              onValueChange={(v) => { setState_(v ?? ""); setDistrict(""); setDistrictOtherText(""); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {statesForRegion.map((s) => (
                  <SelectItem key={s.state} value={s.state}>
                    {s.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="state" value={state_} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>District / City</Label>
            <Select value={district} onValueChange={(v) => setDistrict(v ?? "")} disabled={!state_}>
              <SelectTrigger>
                <SelectValue>
                  {(value: string) => {
                    if (!value) return state_ ? "Select district" : "Select state first";
                    return value === OTHER_VALUE ? "Other (specify)" : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {districtsForState.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_VALUE}>Other (specify)</SelectItem>
              </SelectContent>
            </Select>
            {districtIsOther && (
              <Input
                value={districtOtherText}
                onChange={(e) => setDistrictOtherText(e.target.value)}
                placeholder="Specify district/city…"
              />
            )}
            <input type="hidden" name="district_city" value={resolvedDistrict} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Aspirational District</Label>
            <div className="flex h-9 items-center">
              {aspirational ? (
                <Badge
                  variant="outline"
                  className={
                    aspirational.is_aspirational
                      ? "border-[#8a3ffc] bg-[#f6f2ff] text-[#6929c4]"
                      : "border-[#c6c6c6] bg-[#f4f4f4] text-[#525252]"
                  }
                >
                  {aspirational.is_aspirational ? "Yes" : "No"}
                </Badge>
              ) : (
                <span className="text-sm text-neutral-400">Auto-filled from district</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="hobli">Hobli / Taluk</Label>
            <Input id="hobli" name="hobli" defaultValue={lead?.hobli ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Outreach Pillar</Label>
            <Select value={pillar} onValueChange={(v) => setPillar(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select pillar" />
              </SelectTrigger>
              <SelectContent>
                {OUTREACH_PILLARS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="institution_type" value={pillar} />
          </div>

          <SelectWithOther
            name="institution_channel"
            label="Outreach Channel"
            options={channelsForPillar}
            defaultValue={lead?.institution_channel}
            placeholder={pillar ? "Select channel" : "Select pillar first"}
            disabled={!pillar}
          />

          <SelectWithOther
            name="outreach_mode"
            label="Outreach Mode"
            options={OUTREACH_MODES}
            defaultValue={lead?.outreach_mode}
          />

          <div className="grid grid-cols-1 gap-4 rounded-md border p-3 sm:col-span-2 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact_person">Contact person</Label>
              <Input id="contact_person" name="contact_person" defaultValue={lead?.contact_person ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" name="designation" defaultValue={lead?.designation ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mobile_no">Mobile No.</Label>
              <Input id="mobile_no" name="mobile_no" type="tel" inputMode="tel" defaultValue={lead?.mobile_no ?? ""} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-3">
              <Label htmlFor="email_id">Email</Label>
              <Input id="email_id" name="email_id" type="email" inputMode="email" defaultValue={lead?.email_id ?? ""} />
            </div>
          </div>

          <SelectWithOther
            name="planned_activity"
            label="Outreach Activity"
            options={OUTREACH_ACTIVITIES}
            defaultValue={lead?.planned_activity}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="planned_date">Planned date *</Label>
            <Input
              id="planned_date"
              name="planned_date"
              type="date"
              defaultValue={lead?.planned_date ?? ""}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="no_of_institutions">Total students</Label>
            <Input id="no_of_institutions" name="no_of_institutions" type="number" inputMode="numeric" defaultValue={lead?.no_of_institutions ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="planned_girls_reach">Planned girls reach</Label>
            <Input id="planned_girls_reach" name="planned_girls_reach" type="number" inputMode="numeric" defaultValue={lead?.planned_girls_reach ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "Planned")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="status" value={status} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="responsible_member">Responsible member</Label>
            {mode === "create" && !isAdmin ? (
              <>
                <Input id="responsible_member" value={currentUserName} disabled />
                <input type="hidden" name="responsible_member" value={currentUserName} />
              </>
            ) : (
              <Input
                id="responsible_member"
                name="responsible_member"
                defaultValue={lead?.responsible_member ?? ""}
              />
            )}
          </div>

          {mode === "edit" && (
            <div className="grid grid-cols-1 gap-4 rounded-md border p-3 sm:col-span-2 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="executed_date">Executed date</Label>
                <Input id="executed_date" name="executed_date" type="date" defaultValue={lead?.executed_date ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="girls_reached">Girls reached</Label>
                <Input id="girls_reached" name="girls_reached" type="number" inputMode="numeric" defaultValue={lead?.girls_reached ?? ""} />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="activity_undertaken">Activity undertaken</Label>
                <Input id="activity_undertaken" name="activity_undertaken" defaultValue={lead?.activity_undertaken ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="quick_interest_form_submitted">Interest forms submitted</Label>
                <Input
                  id="quick_interest_form_submitted"
                  name="quick_interest_form_submitted"
                  type="number"
                  inputMode="numeric"
                  defaultValue={lead?.quick_interest_form_submitted ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="drive_link">Google Drive link</Label>
                <Input
                  id="drive_link"
                  name="drive_link"
                  type="url"
                  defaultValue={lead?.drive_link ?? ""}
                  placeholder="Link to session photos/evidence…"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" name="remarks" defaultValue={lead?.remarks ?? ""} />
          </div>

          {state.error && <p className="text-sm text-[#da1e28] sm:col-span-2">{state.error}</p>}

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Create lead" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
