"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DRAFT_COLOR = "#c6c6c6";
const APPLIED_COLOR = "#0f62fe";
const AXIS_TICK = { fontSize: 12, fill: "#737373" };

export type VolumeDay = { date: string; label: string; draft: number; applied: number };

export function VolumeOverTimeCard({ data }: { data: VolumeDay[] }) {
  const [mode, setMode] = useState<"area" | "bar">("area");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Application volume over time</CardTitle>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === "area" ? "default" : "outline"}
            onClick={() => setMode("area")}
          >
            Area
          </Button>
          <Button
            size="sm"
            variant={mode === "bar" ? "default" : "outline"}
            onClick={() => setMode("bar")}
          >
            Bar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {mode === "area" ? (
            <AreaChart data={data} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="draft"
                name="Draft"
                stackId="1"
                stroke={DRAFT_COLOR}
                fill={DRAFT_COLOR}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="applied"
                name="Applied"
                stackId="1"
                stroke={APPLIED_COLOR}
                fill={APPLIED_COLOR}
                fillOpacity={0.6}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="draft" name="Draft" stackId="s" fill={DRAFT_COLOR} />
              <Bar dataKey="applied" name="Applied" stackId="s" fill={APPLIED_COLOR} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
