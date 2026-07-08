import { requireProfile } from "@/lib/data/session";
import { getLeads } from "@/lib/data/leads";
import { getTeams } from "@/lib/data/lookups";
import { IndiaMap } from "@/components/india-map";

export default async function MapPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  // No team filter: RLS scopes rows to what this profile can see already.
  const [leads, teams] = await Promise.all([getLeads(), getTeams()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Map</h1>
        <p className="text-sm text-neutral-500">
          Where outreach is happening, across {isAdmin ? "all teams" : "your leads"}. Click a state
          to zoom in and see its districts.
        </p>
      </div>
      <IndiaMap leads={leads} teams={teams} isAdmin={isAdmin} />
    </div>
  );
}
