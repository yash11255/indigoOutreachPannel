"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfileForAction, requireAdminForAction } from "@/lib/data/session";
import { stageForStatus, type CancelInput } from "@/lib/types";
import { hasAwarenessSession } from "@/lib/outreach-taxonomy";

export type LeadFormState = { error?: string; success?: boolean };

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Appends a new remark to whatever is already in a row's `remarks` column, rather than overwriting it. */
async function appendRemarks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "leads" | "lead_rounds",
  id: string,
  addition: string,
  label: string = "Completed",
): Promise<string> {
  const { data } = await supabase
    .from(table)
    .select("remarks")
    .eq("id", id)
    .single();
  const existing = data?.remarks?.trim();
  return existing
    ? `${existing} | ${label}: ${addition}`
    : `${label}: ${addition}`;
}

/**
 * Whether every round for a lead — round 1 (the lead row itself) plus every
 * lead_rounds row — is resolved: either executed, or cancelled (Rejected /
 * No Response — the "stalled" stage). Rounds can now be completed out of
 * order (an ad-hoc round can finish before an earlier-planned one), so the
 * lead only counts as fully "Activity Completed" once nothing is left
 * pending, not just whenever any single round finishes.
 *
 * A cancelled round never gets an executed_date (cancelRound only sets
 * status), so checking executed_date alone would make a lead with any
 * cancelled round stuck on "Planned" forever, even after every other round
 * — including a later, successful one — finishes. Cancelled counts as
 * resolved, same as the UI's own "roundResolved" check elsewhere.
 */
async function allRoundsDone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  round1ExecutedDate: string | null,
): Promise<boolean> {
  if (!round1ExecutedDate) return false;
  const { data } = await supabase
    .from("lead_rounds")
    .select("executed_date, status")
    .eq("lead_id", leadId);
  return (data ?? []).every(
    (r) => !!r.executed_date || stageForStatus(r.status) === "stalled",
  );
}

/**
 * Whether a genuine awareness session has ever been recorded anywhere in
 * this lead's history — round 1 (the lead row) plus every lead_rounds row —
 * optionally including one not-yet-written activity for the round currently
 * being resolved. This is the gate for auto-completing a lead: resolving a
 * round (executing OR cancelling it) should never by itself flip the whole
 * lead to "Activity Completed" just because nothing else happens to be
 * pending yet — only a real session does that. Closing a lead out *without*
 * a session is a deliberate act via the Cancel (Rejected/No Response) path,
 * not a side effect of routine execution.
 */
async function leadHasGenuineSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  extraActivity?: string | null,
): Promise<boolean> {
  const [{ data: leadRow }, { data: rounds }] = await Promise.all([
    supabase.from("leads").select("activity_undertaken").eq("id", leadId).single(),
    supabase.from("lead_rounds").select("activity_undertaken").eq("lead_id", leadId),
  ]);
  return hasAwarenessSession([
    leadRow?.activity_undertaken,
    ...(rounds ?? []).map((r) => r.activity_undertaken),
    extraActivity,
  ]);
}

/**
 * Whether the lead has at least a contact person plus one way to reach them
 * (mobile or email) on file. SPOC contact is intentionally optional while a
 * lead is still early in the pipeline ("Contact Details Pending" etc.) — but
 * a lead shouldn't be considered genuinely "done" if nobody on the team ever
 * captured who was actually spoken to.
 */
async function leadHasContactDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("leads")
    .select("contact_person, mobile_no, email_id")
    .eq("id", leadId)
    .single();
  return !!(data?.contact_person && (data?.mobile_no || data?.email_id));
}

/**
 * The single completion gate, used by every path that can resolve a lead's
 * rounds: every round resolved, a genuine awareness session recorded
 * somewhere, and contact details on file. All three must hold before a lead
 * is truly "Activity Completed" — resolving a round without all three just
 * keeps the lead "Planned" (open), never forces a premature completion.
 */
async function shouldAutoComplete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  opts: { round1ExecutedDate: string | null; extraActivity?: string | null },
): Promise<boolean> {
  const [allDone, hasSession, hasContact] = await Promise.all([
    allRoundsDone(supabase, leadId, opts.round1ExecutedDate),
    leadHasGenuineSession(supabase, leadId, opts.extraActivity),
    leadHasContactDetails(supabase, leadId),
  ]);
  return allDone && hasSession && hasContact;
}

/** Fields shared by create + update, pulled from FormData. */
function leadFieldsFromForm(fd: FormData) {
  return {
    region: str(fd, "region"),
    state: str(fd, "state"),
    district_city: str(fd, "district_city"),
    hobli: str(fd, "hobli"),
    institution_type: str(fd, "institution_type"),
    institution_channel: str(fd, "institution_channel"),
    institution_name: str(fd, "institution_name") ?? "",
    outreach_mode: str(fd, "outreach_mode"),
    contact_person: str(fd, "contact_person"),
    designation: str(fd, "designation"),
    mobile_no: str(fd, "mobile_no"),
    email_id: str(fd, "email_id"),
    no_of_institutions: num(fd, "no_of_institutions"),
    planned_girls_reach: num(fd, "planned_girls_reach"),
    girls_reached: num(fd, "girls_reached"),
    planned_activity: str(fd, "planned_activity"),
    planned_date: str(fd, "planned_date"),
    status: str(fd, "status") ?? "Planned",
    executed_date: str(fd, "executed_date"),
    activity_undertaken: str(fd, "activity_undertaken"),
    quick_interest_form_submitted: num(fd, "quick_interest_form_submitted"),
    responsible_member: str(fd, "responsible_member"),
    remarks: str(fd, "remarks"),
    drive_link: str(fd, "drive_link"),
  };
}

export async function createLead(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const profile = await requireProfileForAction();
  const supabase = await createClient();

  const teamId =
    profile.role === "admin"
      ? (str(formData, "team_id") ?? profile.team_id)
      : profile.team_id;

  if (!teamId) return { error: "No team selected." };

  const fields = leadFieldsFromForm(formData);

  // Every field is mandatory for a newly-created lead except SPOC contact
  // (contact_person/designation/mobile_no/email_id) — that's deliberately
  // optional since the pipeline's own "Contact Details Pending"/"Contact
  // Identified" statuses assume it isn't known yet when a lead is first
  // logged. updateLead() stays lenient on all of this so old imported leads
  // with gaps can still be edited incrementally.
  if (!fields.institution_name)
    return { error: "Institution name is required." };
  if (!fields.region) return { error: "Region is required." };
  if (!fields.state) return { error: "State is required." };
  if (!fields.district_city) return { error: "District / City is required." };
  if (!fields.institution_type)
    return { error: "Outreach Pillar is required." };
  if (!fields.institution_channel)
    return { error: "Outreach Channel is required." };
  if (!fields.outreach_mode) return { error: "Outreach Mode is required." };
  if (!fields.planned_activity)
    return { error: "Outreach Activity is required." };
  if (!fields.planned_date) return { error: "Planned date is required." };
  // Total students / Planned girls reach only make sense once this is a
  // genuine awareness session — a meeting, email, or WhatsApp round has no
  // headcount to plan for.
  if (hasAwarenessSession([fields.planned_activity])) {
    if (fields.no_of_institutions == null)
      return { error: "Total students is required." };
    if (fields.planned_girls_reach == null)
      return { error: "Planned girls reach is required." };
  }
  if (profile.role === "admin" && !fields.responsible_member)
    return { error: "Responsible member is required." };

  // Members always show up as the responsible member for their own leads —
  // fetched from their profile, not typed in. Admins (who may be creating on
  // behalf of any team) keep manual control over this field.
  const responsibleMember =
    profile.role === "admin"
      ? fields.responsible_member
      : profile.full_name || profile.email;

  const { error } = await supabase.from("leads").insert({
    ...fields,
    responsible_member: responsibleMember,
    team_id: teamId,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/leads");
  revalidatePath("/calendar");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateLead(
  leadId: string,
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  await requireProfileForAction();
  const supabase = await createClient();

  const fields = leadFieldsFromForm(formData);
  if (!fields.institution_name)
    return { error: "Institution name is required." };

  const { error } = await supabase
    .from("leads")
    .update(fields)
    .eq("id", leadId);
  if (error) return { error: error.message };

  // The Edit form can set round 1's own executed_date/activity_undertaken/
  // contact fields directly, bypassing the guided "Mark as executed" dialog
  // — if that now satisfies every completion criterion (genuine session +
  // every round resolved + contact details on file), bring `status` in line
  // even though the form's own Status field wasn't necessarily touched. This
  // only ever upgrades to "Activity Completed"; it never overrides an
  // explicit Rejected/No Response/Planned choice when the criteria aren't
  // actually met.
  if (fields.status !== "Activity Completed") {
    const shouldComplete = await shouldAutoComplete(supabase, leadId, {
      round1ExecutedDate: fields.executed_date,
    });
    if (shouldComplete) {
      const { error: statusError } = await supabase
        .from("leads")
        .update({ status: "Activity Completed" })
        .eq("id", leadId);
      if (statusError) return { error: statusError.message };
    }
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/calendar");
  revalidatePath("/admin");
  return { success: true };
}

export type MarkExecutedInput = {
  executedDate: string;
  activityUndertaken?: string;
  girlsReached?: number;
  totalStudents?: number;
  driveLink?: string;
  completionRemarks?: string;
};

/**
 * Marks a lead as executed: requires an executed date, and records the
 * round's own details. This alone never completes the lead — it only flips
 * to "Activity Completed" once every round is resolved AND a genuine
 * awareness session has happened somewhere in the history; otherwise it
 * stays "Planned" (open) even if nothing else is currently pending, since
 * more rounds may still be coming. To close a lead out *without* a session,
 * use the regular edit form / Cancel action and pick "Rejected"/"No
 * Response" instead — that's the deliberate way to end it early.
 *
 * Curried as (leadId) => (input) so Server Components can pass
 * `markLeadExecuted.bind(null, lead.id)` down to a Client Component — a
 * plain closure wrapping a server action can't cross that boundary, but a
 * bound reference to the action itself can.
 */
export async function markLeadExecuted(
  leadId: string,
  input: MarkExecutedInput,
) {
  await requireProfileForAction();
  const supabase = await createClient();

  // This round (round 1) is done, but other rounds may still be pending (they
  // don't have to finish in order) — only call the whole lead "Completed"
  // once nothing else is left outstanding AND a genuine session has happened
  // AND contact details are on file.
  const shouldComplete = await shouldAutoComplete(supabase, leadId, {
    round1ExecutedDate: input.executedDate,
    extraActivity: input.activityUndertaken,
  });

  const { error } = await supabase
    .from("leads")
    .update({
      status: shouldComplete ? "Activity Completed" : "Planned",
      executed_date: input.executedDate,
      activity_undertaken: input.activityUndertaken ?? null,
      girls_reached: input.girlsReached ?? null,
      no_of_institutions: input.totalStudents ?? null,
      drive_link: input.driveLink ?? null,
      ...(input.completionRemarks
        ? {
            remarks: await appendRemarks(
              supabase,
              "leads",
              leadId,
              input.completionRemarks,
            ),
          }
        : {}),
    })
    .eq("id", leadId);

  if (error) throw new Error(error.message);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/calendar");
  revalidatePath("/admin");
}

/**
 * Marks round 1 (the lead itself) as cancelled — it was planned but isn't
 * happening. Unlike markLeadExecuted this doesn't set an executed_date; it
 * just resolves the status to Rejected/No Response, same vocabulary as the
 * Edit form's Status picker.
 */
export async function cancelLead(leadId: string, input: CancelInput) {
  await requireProfileForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({
      status: input.status,
      ...(input.remarks
        ? {
            remarks: await appendRemarks(
              supabase,
              "leads",
              leadId,
              input.remarks,
              "Cancelled",
            ),
          }
        : {}),
    })
    .eq("id", leadId);

  if (error) throw new Error(error.message);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/calendar");
  revalidatePath("/admin");
}

/**
 * Reverses a wrongly-completed lead: sets it back to "Planned" and clears
 * executed_date, so it re-enters the normal pipeline instead of sitting in
 * Completed with nothing genuine behind it. For leads that were marked
 * executed off a flyer/email/meeting instead of an actual awareness
 * session — see AWARENESS_SESSION_ACTIVITIES in lib/outreach-taxonomy.ts
 * and the /admin/needs-session audit page this feeds. Admin-only: this
 * undoes someone else's completed status, not a routine edit.
 */
export async function reopenLead(leadId: string, reason?: string) {
  await requireAdminForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({
      status: "Planned",
      executed_date: null,
      remarks: await appendRemarks(
        supabase,
        "leads",
        leadId,
        reason || "No genuine awareness session was recorded — reopened for redo.",
        "Reopened",
      ),
    })
    .eq("id", leadId);

  if (error) throw new Error(error.message);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/calendar");
  revalidatePath("/admin");
  revalidatePath("/admin/needs-session");
}

/** Adds another round (touchpoint) to a lead — round 2, 3, etc. */
export async function createLeadRound(input: {
  leadId: string;
  title?: string;
  plannedDate: string;
  totalStudents?: number;
  totalGirls?: number;
}) {
  const profile = await requireProfileForAction();
  const supabase = await createClient();

  const { count } = await supabase
    .from("lead_rounds")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", input.leadId);

  const { error } = await supabase.from("lead_rounds").insert({
    lead_id: input.leadId,
    sequence_no: (count ?? 0) + 2, // round 1 is the lead itself
    title: input.title || null,
    planned_date: input.plannedDate,
    no_of_institutions: input.totalStudents ?? null,
    planned_girls_reach: input.totalGirls ?? null,
    status: "Planned",
    created_by: profile.id,
  });

  if (error) throw new Error(error.message);

  // A new round means there's a fresh pending activity — keep the lead's own
  // `status` (what Kanban/admin stats key off) in sync so it moves back out
  // of "Completed" now that the pipeline isn't actually finished anymore.
  const { error: leadError } = await supabase
    .from("leads")
    .update({ status: "Planned" })
    .eq("id", input.leadId);
  if (leadError) throw new Error(leadError.message);

  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/leads");
  revalidatePath("/calendar");
  revalidatePath("/admin");
}

/** Same as markLeadExecuted, but for a specific round rather than the lead itself. */
export async function markRoundExecuted(
  roundId: string,
  leadId: string,
  input: MarkExecutedInput,
) {
  await requireProfileForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lead_rounds")
    .update({
      status: "Activity Completed",
      executed_date: input.executedDate,
      activity_undertaken: input.activityUndertaken ?? null,
      girls_reached: input.girlsReached ?? null,
      no_of_institutions: input.totalStudents ?? null,
      drive_link: input.driveLink ?? null,
      ...(input.completionRemarks
        ? {
            remarks: await appendRemarks(
              supabase,
              "lead_rounds",
              roundId,
              input.completionRemarks,
            ),
          }
        : {}),
    })
    .eq("id", roundId);

  if (error) throw new Error(error.message);

  // Mirror onto the parent lead: Kanban/admin stats key off `leads.status`
  // directly (they don't look at lead_rounds). Rounds can finish out of
  // order, so only flip to Completed once every round (including this one)
  // is resolved AND a genuine session has happened AND contact details are
  // on file — otherwise keep it Planned, since something's still missing.
  const { data: leadRow } = await supabase
    .from("leads")
    .select("executed_date")
    .eq("id", leadId)
    .single();
  const shouldComplete = await shouldAutoComplete(supabase, leadId, {
    round1ExecutedDate: leadRow?.executed_date ?? null,
    extraActivity: input.activityUndertaken,
  });
  const { error: leadError } = await supabase
    .from("leads")
    .update({ status: shouldComplete ? "Activity Completed" : "Planned" })
    .eq("id", leadId);
  if (leadError) throw new Error(leadError.message);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/calendar");
  revalidatePath("/admin");
}

export type UpdateRoundInput = {
  title?: string;
  status: string;
  plannedDate?: string;
  executedDate?: string;
  totalStudents?: number;
  plannedGirlsReach?: number;
  girlsReached?: number;
  activityUndertaken?: string;
  driveLink?: string;
  remarks?: string;
};

/**
 * Directly edits any of a round's own fields, regardless of whether it's
 * already resolved. markRoundExecuted/cancelRound only run once, as part of
 * the Planned -> Completed/Rejected transition — once a round is resolved
 * there's otherwise no way to fix a typo or correct a wrong number in what
 * was recorded.
 */
export async function updateRound(
  roundId: string,
  leadId: string,
  input: UpdateRoundInput,
) {
  await requireProfileForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lead_rounds")
    .update({
      title: input.title ?? null,
      status: input.status,
      planned_date: input.plannedDate ?? null,
      executed_date: input.executedDate ?? null,
      no_of_institutions: input.totalStudents ?? null,
      planned_girls_reach: input.plannedGirlsReach ?? null,
      girls_reached: input.girlsReached ?? null,
      activity_undertaken: input.activityUndertaken ?? null,
      drive_link: input.driveLink ?? null,
      remarks: input.remarks ?? null,
    })
    .eq("id", roundId);

  if (error) throw new Error(error.message);

  // Same re-sync as markRoundExecuted: editing a round's executed_date or
  // activity_undertaken here can change whether every round is now done and
  // whether a genuine session is now on record.
  const { data: leadRow } = await supabase
    .from("leads")
    .select("executed_date")
    .eq("id", leadId)
    .single();
  const shouldComplete = await shouldAutoComplete(supabase, leadId, {
    round1ExecutedDate: leadRow?.executed_date ?? null,
  });
  const { error: leadError } = await supabase
    .from("leads")
    .update({ status: shouldComplete ? "Activity Completed" : "Planned" })
    .eq("id", leadId);
  if (leadError) throw new Error(leadError.message);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/calendar");
  revalidatePath("/admin");
}

/**
 * Marks a round as cancelled — it was planned but isn't happening. Same
 * shape as cancelLead, just targeting a lead_rounds row instead.
 *
 * A cancelled round counts as *resolved* (see allRoundsDone), not pending —
 * e.g. round 1 was a meeting, round 2's session got halted and is cancelled,
 * round 3 later holds the actual session: the lead should still resolve to
 * Activity Completed once round 3 executes, not stay stuck on Planned
 * because round 2 never got an executed_date. That means cancelling a round
 * can itself be the action that finishes a lead — if round 1 already
 * executed and every other round is now resolved (executed or cancelled),
 * this re-syncs the parent lead to Activity Completed right here, the same
 * way markRoundExecuted does; nothing else re-checks this after a
 * cancellation otherwise.
 */
export async function cancelRound(
  roundId: string,
  leadId: string,
  input: CancelInput,
) {
  await requireProfileForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lead_rounds")
    .update({
      status: input.status,
      ...(input.remarks
        ? {
            remarks: await appendRemarks(
              supabase,
              "lead_rounds",
              roundId,
              input.remarks,
              "Cancelled",
            ),
          }
        : {}),
    })
    .eq("id", roundId);

  if (error) throw new Error(error.message);

  const { data: leadRow } = await supabase
    .from("leads")
    .select("executed_date")
    .eq("id", leadId)
    .single();
  const shouldComplete = await shouldAutoComplete(supabase, leadId, {
    round1ExecutedDate: leadRow?.executed_date ?? null,
  });
  // A cancelled round never carries a session itself — only mark the whole
  // lead "Activity Completed" if a real session already happened elsewhere.
  // Otherwise leave `leads.status` as-is: cancelling this round doesn't by
  // itself close out a lead with no session on record — that's a deliberate
  // choice made via cancelling round 1 / the lead itself with a Rejected/No
  // Response reason, not a side effect of resolving one round.
  if (shouldComplete) {
    const { error: leadError } = await supabase
      .from("leads")
      .update({ status: "Activity Completed" })
      .eq("id", leadId);
    if (leadError) throw new Error(leadError.message);
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/calendar");
  revalidatePath("/admin");
}

/**
 * Logs an interim outreach-update note against a lead (roundId = null) or
 * one of its rounds, while that step is still in progress. Once the
 * lead/round has an executed_date, its in-progress phase is over — the
 * "Add update" action is hidden client-side for that step, and this action
 * refuses to write to an already-executed step so the log can't be edited
 * after the fact via a stale open dialog.
 */
export async function addLeadUpdate(input: {
  leadId: string;
  roundId: string | null;
  note: string;
}) {
  const profile = await requireProfileForAction();
  const supabase = await createClient();

  const note = input.note.trim();
  if (!note) throw new Error("Update note is required.");

  const table = input.roundId ? "lead_rounds" : "leads";
  const { data: target } = await supabase
    .from(table)
    .select("executed_date")
    .eq("id", input.roundId ?? input.leadId)
    .single();
  if (target?.executed_date) {
    throw new Error(
      "This round is already executed — it can no longer take new updates.",
    );
  }

  const { error } = await supabase.from("lead_updates").insert({
    lead_id: input.leadId,
    round_id: input.roundId,
    note,
    created_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/leads/${input.leadId}`);
}

/**
 * Changes an activity's planned date — a lead (roundId = null) or one of its
 * rounds got rescheduled. Logs the change as an outreach update (same log
 * "Add update" writes to) so there's a record of what the date used to be,
 * rather than silently overwriting it.
 */
export async function rescheduleActivity(input: {
  leadId: string;
  roundId: string | null;
  plannedDate: string;
}) {
  const profile = await requireProfileForAction();
  const supabase = await createClient();

  if (!input.plannedDate) throw new Error("Planned date is required.");

  const table = input.roundId ? "lead_rounds" : "leads";
  const targetId = input.roundId ?? input.leadId;

  const { data: current } = await supabase
    .from(table)
    .select("planned_date")
    .eq("id", targetId)
    .single();
  const oldDate = current?.planned_date;

  if (oldDate === input.plannedDate) return;

  const { error } = await supabase
    .from(table)
    .update({ planned_date: input.plannedDate })
    .eq("id", targetId);
  if (error) throw new Error(error.message);

  await supabase.from("lead_updates").insert({
    lead_id: input.leadId,
    round_id: input.roundId,
    note: oldDate
      ? `Planned date changed from ${oldDate} to ${input.plannedDate}`
      : `Planned date set to ${input.plannedDate}`,
    created_by: profile.id,
  });

  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/leads");
  revalidatePath("/calendar");
}

export async function deleteLead(leadId: string) {
  const profile = await requireProfileForAction();
  if (profile.role !== "admin") throw new Error("Forbidden: admin only");

  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);

  revalidatePath("/leads");
  revalidatePath("/admin");
}
