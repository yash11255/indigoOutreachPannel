import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRecords } from "./api";
import { mapRegistered, mapAppliedOrDraft } from "./map";
import type { ScholarshipApplicationRow, ScholarshipSyncResult } from "./types";

const UPSERT_BATCH_SIZE = 500;

/** True whenever SCHOLARSBOX_API_KEY is configured — callers should check
 * this before wiring up anything sync-related, so the app behaves exactly
 * as it does today (manual data only) when it's unset. */
export function isScholarshipSyncEnabled(): boolean {
  return !!process.env.SCHOLARSBOX_API_KEY;
}

/** Pulls every registered/applied/draft record from the Scholarship Portal
 * API, flattens + maps each into our schema, and upserts into
 * scholarship_applications (keyed on source_id, so re-running is safe and
 * idempotent). Records a row in scholarship_sync_runs for the "Sync Now"
 * button's result summary and "last synced" timestamp. */
export async function runScholarshipSync(): Promise<ScholarshipSyncResult> {
  const apiKey = process.env.SCHOLARSBOX_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SCHOLARSBOX_API_KEY is not set — live sync is disabled.",
    );
  }

  const admin = createAdminClient();
  const { data: run, error: runError } = await admin
    .from("scholarship_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  try {
    const [registeredRaw, appliedRaw, draftRaw] = await Promise.all([
      fetchAllRecords("registered", apiKey),
      fetchAllRecords("applied", apiKey),
      fetchAllRecords("draft", apiKey),
    ]);

    const rows: ScholarshipApplicationRow[] = [
      ...registeredRaw.map(mapRegistered),
      ...appliedRaw.map(mapAppliedOrDraft),
      ...draftRaw.map(mapAppliedOrDraft),
    ].filter((r) => !!r.source_id);

    for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
      const { error } = await admin
        .from("scholarship_applications")
        .upsert(batch, { onConflict: "source_id" });
      if (error) throw new Error(error.message);
    }

    const result: ScholarshipSyncResult = {
      registered: registeredRaw.length,
      applied: appliedRaw.length,
      draft: draftRaw.length,
      total: rows.length,
    };

    await admin
      .from("scholarship_sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        registered_count: result.registered,
        applied_count: result.applied,
        draft_count: result.draft,
      })
      .eq("id", run.id);

    return result;
  } catch (err) {
    await admin
      .from("scholarship_sync_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq("id", run.id);
    throw err;
  }
}
