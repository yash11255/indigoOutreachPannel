"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryBreakdownCard } from "./category-breakdown-card";
import { ScholarshipIndiaMap } from "./scholarship-india-map";
import type { ScholarshipApplication } from "@/lib/data/scholarship";
import { groupByCategory, filterByRecordType, type RecordFilter } from "@/lib/scholarship/aggregate";
import type { RegionState } from "@/lib/types";

/** India's 8 union territories — everything else in the state list is a state. */
const UNION_TERRITORIES = new Set(
  [
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
  ].map((s) => s.toLowerCase()),
);

const RECORD_FILTERS: { value: RecordFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "applied", label: "Applied" },
];

function RecordFilterToggle({
  value,
  onChange,
}: {
  value: RecordFilter;
  onChange: (v: RecordFilter) => void;
}) {
  return (
    <div className="flex gap-1">
      {RECORD_FILTERS.map((f) => (
        <Button
          key={f.value}
          size="sm"
          variant={value === f.value ? "default" : "outline"}
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}

export function ScholarshipAnalytics({
  applications,
  regionsStates,
}: {
  applications: ScholarshipApplication[];
  regionsStates: RegionState[];
}) {
  const [filter, setFilter] = useState<RecordFilter>("all");
  const [districtState, setDistrictState] = useState<string>("");
  const [districtSearch, setDistrictSearch] = useState("");

  const filtered = useMemo(
    () => filterByRecordType(applications, filter),
    [applications, filter],
  );

  const stateToRegion = useMemo(
    () => new Map(regionsStates.map((rs) => [rs.state.toLowerCase(), rs.region])),
    [regionsStates],
  );
  const regionOf = (state: string | null) =>
    state ? (stateToRegion.get(state.trim().toLowerCase()) ?? null) : null;

  const byDate = useMemo(() => {
    const map = new Map<string, { draft: number; applied: number }>();
    for (const a of filtered) {
      if (a.record_type === "registered") continue;
      const key = a.applied_date ?? a.created_at.slice(0, 10);
      const entry = map.get(key) ?? { draft: 0, applied: 0 };
      if (a.record_type === "draft") entry.draft += 1;
      else entry.applied += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([date, stats]) => ({
        category: new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "2-digit",
        }),
        draft: stats.draft,
        applied: stats.applied,
        total: stats.draft + stats.applied,
        sharePct: 0,
        sortKey: date,
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-60);
  }, [filtered]);

  const byRegion = useMemo(
    () => groupByCategory(filtered, (a) => regionOf(a.state)),
    [filtered, stateToRegion],
  );
  const byState = useMemo(() => groupByCategory(filtered, (a) => a.state), [filtered]);
  const statesOnly = byState.filter(
    (r) => r.category !== "Unspecified" && !UNION_TERRITORIES.has(r.category.toLowerCase()),
  );
  const utsOnly = byState.filter(
    (r) => r.category !== "Unspecified" && UNION_TERRITORIES.has(r.category.toLowerCase()),
  );

  const distinctStates = useMemo(
    () =>
      Array.from(new Set(filtered.map((a) => a.state?.trim()).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b),
      ),
    [filtered],
  );

  const byDistrict = useMemo(() => {
    const scoped = districtState
      ? filtered.filter((a) => a.state?.trim() === districtState)
      : filtered;
    const rows = groupByCategory(scoped, (a) => a.district);
    if (!districtSearch.trim()) return rows;
    const needle = districtSearch.trim().toLowerCase();
    return rows.filter((r) => r.category.toLowerCase().includes(needle));
  }, [filtered, districtState, districtSearch]);

  const byEmploymentStatus = useMemo(
    () => groupByCategory(filtered, (a) => a.employment_status),
    [filtered],
  );
  const byEducationStatus = useMemo(
    () => groupByCategory(filtered, (a) => a.education_status),
    [filtered],
  );
  const byDgcaMedical = useMemo(
    () => groupByCategory(filtered, (a) => a.dgca_medical_class2),
    [filtered],
  );
  const byDgcaComputer = useMemo(
    () => groupByCategory(filtered, (a) => a.dgca_computer_number),
    [filtered],
  );

  return (
    <Tabs defaultValue="date">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TabsList className="w-max flex-wrap">
          <TabsTrigger value="date">Date-wise</TabsTrigger>
          <TabsTrigger value="region">Region-wise</TabsTrigger>
          <TabsTrigger value="map">India map</TabsTrigger>
          <TabsTrigger value="state">State-wise</TabsTrigger>
          <TabsTrigger value="district">District-wise</TabsTrigger>
          <TabsTrigger value="dgca">DGCA Medical + Computer</TabsTrigger>
          <TabsTrigger value="employment">Employment status</TabsTrigger>
          <TabsTrigger value="education">Education status</TabsTrigger>
        </TabsList>
        <RecordFilterToggle value={filter} onChange={setFilter} />
      </div>

      <TabsContent value="date">
        <CategoryBreakdownCard title="Date-wise applications" rows={byDate} maxRows={60} />
      </TabsContent>

      <TabsContent value="region">
        <CategoryBreakdownCard title="Region-wise applications" rows={byRegion} />
      </TabsContent>

      <TabsContent value="map">
        <Card>
          <CardHeader>
            <CardTitle>India map — state-wise applications</CardTitle>
          </CardHeader>
          <CardContent>
            <ScholarshipIndiaMap rows={byState} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="state">
        <div className="flex flex-col gap-4">
          <CategoryBreakdownCard title="States" rows={statesOnly} />
          <CategoryBreakdownCard title="Union territories" rows={utsOnly} />
        </div>
      </TabsContent>

      <TabsContent value="district">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Select
              value={districtState || "__all__"}
              onValueChange={(v) => setDistrictState(!v || v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All states</SelectItem>
                {distinctStates.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search district…"
              value={districtSearch}
              onChange={(e) => setDistrictSearch(e.target.value)}
              className="w-56"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Districts{districtState ? ` — ${districtState}` : ""}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>District</TableHead>
                      <TableHead className="text-right">Draft</TableHead>
                      <TableHead className="text-right">Applied</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Share%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byDistrict.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium">{row.category}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.draft}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.applied}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{row.total}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.sharePct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="dgca">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CategoryBreakdownCard title="DGCA Medical Class 2" rows={byDgcaMedical} variant="pie" />
          <CategoryBreakdownCard title="DGCA Computer Number" rows={byDgcaComputer} variant="pie" />
        </div>
      </TabsContent>

      <TabsContent value="employment">
        <CategoryBreakdownCard title="Employment status" rows={byEmploymentStatus} />
      </TabsContent>

      <TabsContent value="education">
        <CategoryBreakdownCard title="Education status" rows={byEducationStatus} />
      </TabsContent>
    </Tabs>
  );
}
