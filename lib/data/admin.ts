import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("email");
  return data ?? [];
}

export async function getActivityLog(source?: string) {
  const supabase = await createClient();
  let query = supabase.from("activity_log").select("*").order("date", { ascending: false, nullsFirst: false }).limit(500);
  if (source) query = query.eq("source", source);
  const { data } = await query;
  return data ?? [];
}

export async function getActivityPlaybook() {
  const supabase = await createClient();
  const { data } = await supabase.from("activity_playbook").select("*").order("institution_category");
  return data ?? [];
}
