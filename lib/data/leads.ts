import { createClient } from "@/lib/supabase/server";
import type { Lead, LeadRound, LeadUpdate } from "@/lib/types";

/** PostgREST caps a single response at 1000 rows by default — page through in batches so callers always get every matching row, not just the first 1000. */
const PAGE_SIZE = 1000;

// Tried parallelizing this with an upfront `count: "exact"` query so all
// pages could fire at once — measured slower in practice, not faster: an
// exact count under RLS means evaluating the security predicate across the
// whole table just to get a number, which cost more than the sequential
// round trip it was meant to save. Reverted; sequential paging stays.

export async function getLeads(filters?: { teamId?: string; status?: string }): Promise<Lead[]> {
  const supabase = await createClient();
  const all: Lead[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("leads")
      .select("*")
      .order("planned_date", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (filters?.teamId) query = query.eq("team_id", filters.teamId);
    if (filters?.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

export async function getLead(id: string): Promise<Lead | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("*").eq("id", id).single();
  return data ?? null;
}

export async function getLeadRounds(leadId: string): Promise<LeadRound[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_rounds")
    .select("*")
    .eq("lead_id", leadId)
    .order("sequence_no", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Every round across every lead — small table (low hundreds of rows), so
 * fetching it all in one query and grouping by lead_id in memory is cheaper
 * and simpler than an .in() filter keyed on a potentially large lead-id
 * list (which hit PostgREST's request-size limit once before). */
export async function getAllLeadRounds(): Promise<LeadRound[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_rounds").select("*");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** All outreach-update notes logged for a lead, across every round, newest first. */
export async function getLeadUpdates(leadId: string): Promise<LeadUpdate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_updates")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) {
    // 42P01 = undefined_table (raw Postgres), PGRST205 = PostgREST's "table not
    // in schema cache" — either means migration 0006 hasn't been applied to
    // this environment yet. Degrade gracefully rather than taking down the page.
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

/** Upcoming leads by planned_date or executed_date, for the calendar view. */
export async function getUpcomingLeads(filters?: { teamId?: string }): Promise<Lead[]> {
  const supabase = await createClient();
  const all: Lead[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("leads")
      .select("*")
      .or("planned_date.not.is.null,executed_date.not.is.null")
      .order("planned_date", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (filters?.teamId) query = query.eq("team_id", filters.teamId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
