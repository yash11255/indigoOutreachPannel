import Link from "next/link";
import { requireAdmin } from "@/lib/data/session";
import { getRegionsStates } from "@/lib/data/lookups";
import {
  getScholarshipApplications,
  getLatestScholarshipSyncRun,
  groupByCategory,
} from "@/lib/data/scholarship";
import { isScholarshipSyncEnabled } from "@/lib/scholarship/sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBreakdownCard } from "@/components/scholarship/category-breakdown-card";
import { ScholarshipIndiaMap } from "@/components/scholarship/scholarship-india-map";
import { VolumeOverTimeCard, type VolumeDay } from "@/components/scholarship/volume-over-time-card";
import { ScholarshipSyncButton } from "@/components/scholarship/scholarship-sync-button";

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-neutral-50 py-2 pr-3 pl-3.5">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-neutral-400">{sub}</div>}
    </div>
  );
}

const VOLUME_DAYS = 30;

export default async function ScholarshipOverviewPage() {
  await requireAdmin();
  const [applications, regionsStates, latestRun] = await Promise.all([
    getScholarshipApplications(),
    getRegionsStates(),
    getLatestScholarshipSyncRun(),
  ]);

  const stateToRegion = new Map(regionsStates.map((rs) => [rs.state.toLowerCase(), rs.region]));
  const regionOf = (state: string | null) =>
    state ? (stateToRegion.get(state.trim().toLowerCase()) ?? null) : null;

  const registered = applications.filter((a) => a.record_type === "registered").length;
  const draft = applications.filter((a) => a.record_type === "draft").length;
  const applied = applications.filter((a) => a.record_type === "applied").length;
  const statesCovered = new Set(
    applications
      .filter((a) => (a.record_type === "applied" || a.record_type === "draft") && a.state)
      .map((a) => a.state!.trim().toLowerCase()),
  ).size;
  const conversionPct = registered > 0 ? Math.round((applied / registered) * 100) : 0;

  const byRegion = groupByCategory(applications, (a) => regionOf(a.state));
  const byState = groupByCategory(applications, (a) => a.state);
  const byEmploymentStatus = groupByCategory(applications, (a) => a.employment_status);
  const byEducation = groupByCategory(applications, (a) => a.education_qualification);
  const byDgcaMedical = groupByCategory(applications, (a) => a.dgca_medical_class2);
  const byDgcaComputer = groupByCategory(applications, (a) => a.dgca_computer_number);

  // Volume over time: applied_date when we have one (applied records, and
  // draft records that were later submitted), falling back to when we first
  // synced the record for drafts that never got an applied_date.
  const dayMap = new Map<string, { draft: number; applied: number }>();
  const today = new Date();
  for (let i = VOLUME_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), { draft: 0, applied: 0 });
  }
  for (const a of applications) {
    if (a.record_type === "registered") continue;
    const dateKey = a.applied_date ?? a.created_at.slice(0, 10);
    const entry = dayMap.get(dateKey);
    if (!entry) continue;
    if (a.record_type === "draft") entry.draft += 1;
    else entry.applied += 1;
  }
  const volumeData: VolumeDay[] = Array.from(dayMap.entries()).map(([date, stats]) => ({
    date,
    label: new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    ...stats,
  }));

  const topStates = byState.filter((r) => r.category !== "Unspecified").slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Scholarship Portal</h1>
          <p className="text-sm text-neutral-500">
            Applications synced from the Scholarship Portal (ScholarsBox) external API.
          </p>
          <Link
            href="/admin/scholarship/analytics"
            className="mt-1 inline-block text-sm text-blue-600 hover:underline"
          >
            View full analytics →
          </Link>
        </div>
        <ScholarshipSyncButton
          syncEnabled={isScholarshipSyncEnabled()}
          latestRun={latestRun}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Registered" value={registered.toLocaleString("en-IN")} />
        <KpiCard label="Draft" value={draft.toLocaleString("en-IN")} />
        <KpiCard label="Applied" value={applied.toLocaleString("en-IN")} />
        <KpiCard label="States covered" value={statesCovered.toLocaleString("en-IN")} />
        <KpiCard
          label="Conversion"
          value={`${conversionPct}%`}
          sub="Applied ÷ Registered"
        />
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No data yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-500">
            {isScholarshipSyncEnabled()
              ? "No applications have been synced yet — click \"Sync now\" above."
              : "SCHOLARSBOX_API_KEY isn't configured, so live sync is disabled. Set it in the environment to enable this."}
          </CardContent>
        </Card>
      ) : (
        <>
          <VolumeOverTimeCard data={volumeData} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CategoryBreakdownCard title="Region-wise applications" rows={byRegion} />
            <Card>
              <CardHeader>
                <CardTitle>State-wise (India map)</CardTitle>
              </CardHeader>
              <CardContent>
                <ScholarshipIndiaMap rows={byState} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CategoryBreakdownCard title="Employment status" rows={byEmploymentStatus} />
            <CategoryBreakdownCard title="Education qualification" rows={byEducation} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CategoryBreakdownCard title="DGCA Medical Class 2" rows={byDgcaMedical} variant="pie" />
            <CategoryBreakdownCard title="DGCA Computer Number" rows={byDgcaComputer} variant="pie" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top states</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-1.5">
                {topStates.map((row, i) => (
                  <li key={row.category} className="flex items-center gap-3 text-sm">
                    <span className="w-5 shrink-0 text-right text-neutral-400">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{row.category}</span>
                    <span className="text-neutral-500">
                      {row.draft} draft + {row.applied} applied
                    </span>
                    <span className="w-16 shrink-0 text-right font-semibold tabular-nums">
                      {row.total}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
