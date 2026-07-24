"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CategoryBreakdownRow } from "@/lib/data/scholarship";

const DRAFT_COLOR = "#c6c6c6";
const APPLIED_COLOR = "#0f62fe";
const AXIS_TICK = { fontSize: 12, fill: "#737373" };
const PIE_COLORS = ["#0f62fe", "#8a3ffc", "#24a148", "#f1c21b", "#da1e28", "#08bdba", "#ff832b"];

/**
 * The one reusable layout every section of the Scholarship dashboard reduces
 * to: a chart (grouped Draft/Applied bar, or a totals pie) on top, the same
 * data as a "Category | Draft | Applied | Total | Share%" table underneath,
 * and a "Draft X + Applied Y = Total Z" math-check footer so the numbers are
 * never just trusted blindly.
 */
export function CategoryBreakdownCard({
  title,
  rows,
  variant = "bar",
  maxRows,
}: {
  title: string;
  rows: CategoryBreakdownRow[];
  variant?: "bar" | "pie";
  /** Cap the chart (not the table) to the top N categories by total, so a
   * long tail of one-off values doesn't make the chart unreadable. */
  maxRows?: number;
}) {
  const chartRows = maxRows ? rows.slice(0, maxRows) : rows;
  const totalDraft = rows.reduce((sum, r) => sum + r.draft, 0);
  const totalApplied = rows.reduce((sum, r) => sum + r.applied, 0);
  const totalAll = totalDraft + totalApplied;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">No data yet.</p>
        ) : (
          <>
            <ResponsiveContainer
              width="100%"
              height={variant === "pie" ? 260 : Math.max(220, chartRows.length * 34)}
            >
              {variant === "pie" ? (
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={chartRows}
                    dataKey="total"
                    nameKey="category"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {chartRows.map((row, i) => (
                      <Cell key={row.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              ) : (
                <BarChart data={chartRows} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
                  <YAxis type="category" dataKey="category" tick={AXIS_TICK} width={140} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="draft" name="Draft" stackId="s" fill={DRAFT_COLOR} />
                  <Bar dataKey="applied" name="Applied" stackId="s" fill={APPLIED_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Draft</TableHead>
                    <TableHead className="text-right">Applied</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Share%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
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

            <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              Draft {totalDraft.toLocaleString("en-IN")} + Applied{" "}
              {totalApplied.toLocaleString("en-IN")} = Total {totalAll.toLocaleString("en-IN")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
