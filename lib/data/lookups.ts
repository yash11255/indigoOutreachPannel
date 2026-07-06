import { createClient } from "@/lib/supabase/server";
import type { Team, StatusLookup, RegionState, InstitutionType, DistrictMaster } from "@/lib/types";
import { findMatchingDistrict } from "@/lib/india-geo";

export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("*").order("name");
  return data ?? [];
}

export async function getStatuses(): Promise<StatusLookup[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("statuses").select("*").order("sort_order");
  return data ?? [];
}

export async function getRegionsStates(): Promise<RegionState[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("regions_states").select("*").order("region");
  return data ?? [];
}

export async function getInstitutionTypes(): Promise<InstitutionType[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("institution_types").select("*").order("category");
  return data ?? [];
}

/** Full district reference list (780 rows) — small enough to fetch once and filter by state client-side. */
export async function getDistrictsMaster(): Promise<DistrictMaster[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("districts_master").select("*").order("state");
  return data ?? [];
}

/**
 * Looks up whether a lead's district is a NITI Aayog Aspirational District,
 * by fuzzy-matching its free-text district_city against the authoritative
 * Geography Master for that state. Returns null if no confident match.
 */
export async function getAspirationalStatus(
  state: string | null,
  districtCity: string | null,
): Promise<DistrictMaster | null> {
  if (!state || !districtCity) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("districts_master").select("*").eq("state", state);
  if (!data || data.length === 0) return null;

  const matchName = findMatchingDistrict(
    districtCity,
    data.map((d) => d.district),
  );
  if (!matchName) return null;

  return data.find((d) => d.district === matchName) ?? null;
}
