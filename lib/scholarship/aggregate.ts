/**
 * Pure aggregation helpers over ScholarshipApplication[] — deliberately
 * kept free of any server-only imports (unlike lib/data/scholarship.ts,
 * which pulls in next/headers via the Supabase server client) so the
 * Analytics page's client-side All/Draft/Applied toggle can recompute
 * these in the browser without a server round-trip per toggle click.
 */
import type { ScholarshipApplication } from "@/lib/data/scholarship";

export type CategoryBreakdownRow = {
  category: string;
  draft: number;
  applied: number;
  total: number;
  sharePct: number;
};

export type RecordFilter = "all" | "draft" | "applied";

export function filterByRecordType(
  applications: ScholarshipApplication[],
  filter: RecordFilter,
): ScholarshipApplication[] {
  if (filter === "all") {
    return applications.filter((a) => a.record_type !== "registered");
  }
  return applications.filter((a) => a.record_type === filter);
}

/** The shared "Category | Draft | Applied | Total | Share%" shape every
 * chart in this feature reduces to — draft/applied only (registered has no
 * such split; it's a KPI on its own). Rows with no category value are
 * bucketed as "Unspecified" and always sort last. */
export function groupByCategory(
  applications: ScholarshipApplication[],
  categoryOf: (a: ScholarshipApplication) => string | null,
): CategoryBreakdownRow[] {
  const relevant = applications.filter(
    (a) => a.record_type === "applied" || a.record_type === "draft",
  );
  const map = new Map<string, { draft: number; applied: number }>();
  for (const a of relevant) {
    const key = categoryOf(a)?.trim() || "Unspecified";
    const entry = map.get(key) ?? { draft: 0, applied: 0 };
    if (a.record_type === "draft") entry.draft += 1;
    else entry.applied += 1;
    map.set(key, entry);
  }
  const total = relevant.length;
  return Array.from(map.entries())
    .map(([category, { draft, applied }]) => ({
      category,
      draft,
      applied,
      total: draft + applied,
      sharePct: total > 0 ? Math.round(((draft + applied) / total) * 100) : 0,
    }))
    .sort((a, b) => {
      if (a.category === "Unspecified") return 1;
      if (b.category === "Unspecified") return -1;
      return b.total - a.total;
    });
}
