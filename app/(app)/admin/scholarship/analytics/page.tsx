import { requireAdmin } from "@/lib/data/session";
import { getRegionsStates } from "@/lib/data/lookups";
import { getScholarshipApplications } from "@/lib/data/scholarship";
import { ScholarshipAnalytics } from "@/components/scholarship/scholarship-analytics";

export default async function ScholarshipAnalyticsPage() {
  await requireAdmin();
  const [applications, regionsStates] = await Promise.all([
    getScholarshipApplications(),
    getRegionsStates(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Scholarship Analytics</h1>
        <p className="text-sm text-neutral-500">
          Date, region, state, district, and profile breakdowns — filterable by
          Draft / Applied.
        </p>
      </div>
      <ScholarshipAnalytics applications={applications} regionsStates={regionsStates} />
    </div>
  );
}
