"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfileForAction } from "@/lib/data/session";

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
): Promise<string> {
  const { data } = await supabase.from(table).select("remarks").eq("id", id).single();
  const existing = data?.remarks?.trim();
  return existing ? `${existing} | Completed: ${addition}` : `Completed: ${addition}`;
}

/**
 * Whether every round for a lead — round 1 (the lead row itself) plus every
 * lead_rounds row — has an executed_date. Rounds can now be completed out of
 * order (an ad-hoc round can finish before an earlier-planned one), so the
 * lead only counts as fully "Activity Completed" once nothing is left
 * pending, not just whenever any single round finishes.
 */
async function allRoundsDone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  round1ExecutedDate: string | null,
): Promise<boolean> {
  if (!round1ExecutedDate) return false;
  const { data } = await supabase.from("lead_rounds").select("executed_date").eq("lead_id", leadId);
  return (data ?? []).every((r) => !!r.executed_date);
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
    profile.role === "admin" ? str(formData, "team_id") ?? profile.team_id : profile.team_id;

  if (!teamId) return { error: "No team selected." };

  const fields = leadFieldsFromForm(formData);
  if (!fields.institution_name) return { error: "Institution name is required." };
  if (!fields.planned_date) return { error: "Planned date is required." };

  // Members always show up as the responsible member for their own leads —
  // fetched from their profile, not typed in. Admins (who may be creating on
  // behalf of any team) keep manual control over this field.
  const responsibleMember =
    profile.role === "admin" ? fields.responsible_member : profile.full_name || profile.email;

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
  if (!fields.institution_name) return { error: "Institution name is required." };

  const { error } = await supabase.from("leads").update(fields).eq("id", leadId);
  if (error) return { error: error.message };

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
 * Marks a lead as executed: requires an executed date, and always resolves
 * to "Activity Completed" — no manual status picking. If it didn't happen,
 * use the regular edit form and pick "Rejected"/"No Response" there instead;
 * this action specifically means "the activity happened."
 *
 * Curried as (leadId) => (input) so Server Components can pass
 * `markLeadExecuted.bind(null, lead.id)` down to a Client Component — a
 * plain closure wrapping a server action can't cross that boundary, but a
 * bound reference to the action itself can.
 */
export async function markLeadExecuted(leadId: string, input: MarkExecutedInput) {
  await requireProfileForAction();
  const supabase = await createClient();

  // This round (round 1) is done, but other rounds may still be pending (they
  // don't have to finish in order) — only call the whole lead "Completed"
  // once nothing else is left outstanding.
  const allDone = await allRoundsDone(supabase, leadId, input.executedDate);

  const { error } = await supabase
    .from("leads")
    .update({
      status: allDone ? "Activity Completed" : "Planned",
      executed_date: input.executedDate,
      activity_undertaken: input.activityUndertaken ?? null,
      girls_reached: input.girlsReached ?? null,
      no_of_institutions: input.totalStudents ?? null,
      drive_link: input.driveLink ?? null,
      ...(input.completionRemarks ? { remarks: await appendRemarks(supabase, "leads", leadId, input.completionRemarks) } : {}),
    })
    .eq("id", leadId);

  if (error) throw new Error(error.message);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/calendar");
  revalidatePath("/admin");
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
        ? { remarks: await appendRemarks(supabase, "lead_rounds", roundId, input.completionRemarks) }
        : {}),
    })
    .eq("id", roundId);

  if (error) throw new Error(error.message);

  // Mirror onto the parent lead: Kanban/admin stats key off `leads.status`
  // directly (they don't look at lead_rounds). Rounds can finish out of
  // order, so only flip to Completed once every round (including this one)
  // has an executed_date — otherwise keep it Planned since something's still
  // outstanding.
  const { data: leadRow } = await supabase.from("leads").select("executed_date").eq("id", leadId).single();
  const allDone = await allRoundsDone(supabase, leadId, leadRow?.executed_date ?? null);
  const { error: leadError } = await supabase
    .from("leads")
    .update({ status: allDone ? "Activity Completed" : "Planned" })
    .eq("id", leadId);
  if (leadError) throw new Error(leadError.message);

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
    throw new Error("This round is already executed — it can no longer take new updates.");
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

export async function deleteLead(leadId: string) {
  const profile = await requireProfileForAction();
  if (profile.role !== "admin") throw new Error("Forbidden: admin only");

  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);

  revalidatePath("/leads");
  revalidatePath("/admin");
}
