import { createClient } from "@/lib/supabase/server";
import type { Team, StatusLookup, RegionState, InstitutionType, DistrictMaster } from "@/lib/types";
import { findMatchingDistrict } from "@/lib/india-geo";

export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("*").order("name");
  return data ?? [];
}

/**
 * Distinct sub_team values actually in use per team (e.g. BC FutureTech ->
 * IBM/Lenovo/Honeywell/...), for the "which sub-division" picker when
 * creating a team_admin scoped narrower than their whole team. Teams with no
 * sub_team data at all (most of them) just won't have an entry.
 */
export async function getSubTeamsByTeam(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const byTeam = new Map<string, Set<string>>();
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("team_id, sub_team")
      .not("sub_team", "is", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (!row.sub_team) continue;
      const set = byTeam.get(row.team_id) ?? new Set<string>();
      set.add(row.sub_team);
      byTeam.set(row.team_id, set);
    }
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return Object.fromEntries(
    Array.from(byTeam.entries()).map(([teamId, set]) => [
      teamId,
      Array.from(set).sort(),
    ]),
  );
}

export async function getStatuses(): Promise<StatusLookup[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("statuses").select("*").order("sort_order");
  return data ?? [];
}

export async function getRegionsStates(): Promise<RegionState[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("regions_states").select("*").order("region").order("state");
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
  const { data } = await supabase.from("districts_master").select("*").order("state").order("district");
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
