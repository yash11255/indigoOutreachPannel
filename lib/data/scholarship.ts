import { createClient } from "@/lib/supabase/server";

export type { CategoryBreakdownRow } from "@/lib/scholarship/aggregate";
export { groupByCategory } from "@/lib/scholarship/aggregate";

const PAGE_SIZE = 1000;

export type ScholarshipApplication = {
  id: string;
  source_id: string;
  record_type: "registered" | "applied" | "draft";
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  category: string | null;
  state: string | null;
  district: string | null;
  pincode: string | null;
  address: string | null;
  employment_status: string | null;
  education_status: string | null;
  education_qualification: string | null;
  dgca_medical_class2: string | null;
  dgca_computer_number: string | null;
  registration_date: string | null;
  applied_date: string | null;
  answers: Record<string, string>;
  tracking_status: { status: string; dateTime: string }[];
  synced_at: string;
  created_at: string;
  updated_at: string;
};

export type ScholarshipSyncRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  registered_count: number | null;
  applied_count: number | null;
  draft_count: number | null;
  error_message: string | null;
};

/** Every column except the two heavy JSONB blobs (answers, tracking_status)
 * — the Overview/Analytics pages only ever aggregate on the extracted
 * columns, never the raw blobs, and selecting them for every one of
 * thousands of rows measurably slowed page loads (~30s for ~7k rows). */
const LIGHT_COLUMNS =
  "id, source_id, record_type, first_name, last_name, email, phone_number, " +
  "date_of_birth, gender, category, state, district, pincode, address, " +
  "employment_status, education_status, education_qualification, " +
  "dgca_medical_class2, dgca_computer_number, registration_date, " +
  "applied_date, synced_at, created_at, updated_at";

/** All scholarship applications (admin-only, enforced by RLS) — small
 * enough dataset (thousands, not millions) to fetch in full and aggregate
 * in memory, same approach as getLeads(). Omits the raw answers/
 * tracking_status blobs — see LIGHT_COLUMNS. */
export async function getScholarshipApplications(): Promise<ScholarshipApplication[]> {
  const supabase = await createClient();
  const all: ScholarshipApplication[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("scholarship_applications")
      .select(LIGHT_COLUMNS)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    all.push(
      ...((data ?? []) as unknown as Omit<ScholarshipApplication, "answers" | "tracking_status">[]).map(
        (row) => ({ ...row, answers: {}, tracking_status: [] }),
      ),
    );
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/** The most recent *completed* run (success or error) — deliberately
 * excludes rows still stuck in "running" (e.g. the worker process got
 * killed mid-sync and never reached its catch block to mark it "error"),
 * so a stale stuck row never makes the "last synced" display regress to
 * "never" right after a real successful sync. */
export async function getLatestScholarshipSyncRun(): Promise<ScholarshipSyncRun | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scholarship_sync_runs")
    .select("*")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ScholarshipSyncRun | null;
}

