"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_LABELS, type LeadStage } from "@/lib/types";

const STAGE_COLOR: Record<LeadStage, string> = {
  planned: "#c6c6c6",
  outreach_sent: "#0f62fe",
  scheduled: "#f1c21b",
  completed: "#24a148",
  stalled: "#da1e28",
};

const ACHIEVED_GREEN = "#24a148";
const AXIS_TICK = { fontSize: 12, fill: "#737373" };

export type AnalyticsKpis = {
  totalLeads: number;
  completed: number;
  completionRate: number;
  inProgress: number;
  stalled: number;
  plannedGirls: number;
  girlsReached: number;
  girlsReachRate: number;
  activeTeams: number;
  totalTeams: number;
  activeMembers: number;
  totalMembers: number;
  avgTurnaroundDays: number | null;
  dueTillNow: number;
  upcomingPlanned15Days: number;
};

export type AnalyticsData = {
  kpis: AnalyticsKpis;
  stageDistribution: { stage: LeadStage; label: string; value: number }[];
  monthlyTrend: { month: string; label: string; created: number; completed: number }[];
  upcoming15Days: { date: string; label: string; count: number; cumulative: number }[];
  teamStages: {
    team: string;
    planned: number;
    outreach_sent: number;
    scheduled: number;
    completed: number;
    stalled: number;
    total: number;
  }[];
  teamCompletion: { team: string; rate: number }[];
  regionTotals: { region: string; total: number }[];
  stateTotals: { state: string; total: number }[];
  districtTotals: { district: string; total: number }[];
  totalDistinctDistricts: number;
  aspirational: {
    aspirationalCount: number;
    nonAspirationalCount: number;
    unclassifiedCount: number;
    aspirationalRate: number;
    byDistrict: { district: string; state: string; total: number }[];
  };
  topMembers: { member: string; total: number }[];
  memberActive: { active: number; inactive: number };
  girlsReachByTeam: { team: string; planned: number; reached: number }[];
};

const REGION_COLORS = [
  "#0f62fe",
  "#8a3ffc",
  "#24a148",
  "#f1c21b",
  "#da1e28",
  "#08bdba",
  "#ff832b",
  "#6929c4",
];

function KpiCard({
  label,
  value,
  sub,
  achieved,
}: {
  label: string;
  value: string;
  sub?: string;
  achieved?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border bg-neutral-50 py-2 pr-3 pl-3.5">
      {achieved && (
        <div
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: ACHIEVED_GREEN }}
          aria-hidden
        />
      )}
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-neutral-400">{sub}</div>}
    </div>
  );
}

function VerticalBarCard({
  title,
  data,
  dataKey,
  categoryKey,
  color,
  width,
}: {
  title: string;
  data: Record<string, unknown>[];
  dataKey: string;
  categoryKey: string;
  color: string;
  width: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 30)}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
            <YAxis type="category" dataKey={categoryKey} tick={AXIS_TICK} width={width} />
            <Tooltip />
            <Bar dataKey={dataKey} name="Leads" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-neutral-800 first:mt-0">{children}</h2>
  );
}

export function AdminAnalytics({ data }: { data: AnalyticsData }) {
  const { kpis } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Total leads" value={kpis.totalLeads.toLocaleString("en-IN")} />
        <KpiCard
          label="Completed"
          value={kpis.completed.toLocaleString("en-IN")}
          sub={`${kpis.completionRate}% of total`}
          achieved
        />
        <KpiCard label="In progress" value={kpis.inProgress.toLocaleString("en-IN")} />
        <KpiCard label="Stalled" value={kpis.stalled.toLocaleString("en-IN")} />
        <KpiCard
          label="Avg. turnaround"
          value={kpis.avgTurnaroundDays !== null ? `${kpis.avgTurnaroundDays}d` : "—"}
          sub="created → completed"
        />
        <KpiCard
          label="Planned girls reach"
          value={kpis.plannedGirls.toLocaleString("en-IN")}
        />
        <KpiCard
          label="Girls reached"
          value={kpis.girlsReached.toLocaleString("en-IN")}
          sub={`${kpis.girlsReachRate}% of planned`}
          achieved
        />
        <KpiCard
          label="Active teams"
          value={`${kpis.activeTeams} / ${kpis.totalTeams}`}
          sub="with ≥1 lead"
        />
        <KpiCard
          label="Active members"
          value={`${kpis.activeMembers} / ${kpis.totalMembers}`}
          sub="have created a lead"
        />
        <KpiCard
          label="Due till now"
          value={kpis.dueTillNow.toLocaleString("en-IN")}
          sub="planned date passed, not done"
        />
        <KpiCard
          label="Planned — next 15 days"
          value={kpis.upcomingPlanned15Days.toLocaleString("en-IN")}
          sub="institutions with outreach due"
        />
        <KpiCard
          label="Total pending outreach"
          value={(kpis.dueTillNow + kpis.upcomingPlanned15Days).toLocaleString("en-IN")}
          sub={`${kpis.dueTillNow.toLocaleString("en-IN")} due till now + ${kpis.upcomingPlanned15Days.toLocaleString("en-IN")} next 15 days`}
        />
      </div>

      <SectionHeading>Upcoming outreach (next 15 days)</SectionHeading>
      <Card>
        <CardHeader>
          <CardTitle>Institutions planned, day by day</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.upcoming15Days} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Planned that day" fill="#0f62fe" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cumulative (till now)"
                stroke="#24a148"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <SectionHeading>Overview</SectionHeading>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stage distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={data.stageDistribution}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {data.stageDistribution.map((entry) => (
                    <Cell key={entry.stage} fill={STAGE_COLOR[entry.stage]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads over time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.monthlyTrend} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="#0f62fe"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#24a148"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <SectionHeading>By team</SectionHeading>
      <Card>
        <CardHeader>
          <CardTitle>Leads by team (stage breakdown)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(220, data.teamStages.length * 44)}>
            <BarChart
              data={data.teamStages}
              layout="vertical"
              margin={{ left: 20 }}
              barCategoryGap={12}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
              <YAxis type="category" dataKey="team" tick={AXIS_TICK} width={160} />
              <Tooltip />
              <Legend />
              {(Object.keys(STAGE_LABELS) as LeadStage[]).map((stage) => (
                <Bar
                  key={stage}
                  dataKey={stage}
                  name={STAGE_LABELS[stage]}
                  stackId="stage"
                  fill={STAGE_COLOR[stage]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completion rate by team</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer
            width="100%"
            height={Math.max(220, data.teamCompletion.length * 32)}
          >
            <BarChart data={data.teamCompletion} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={AXIS_TICK}
              />
              <YAxis type="category" dataKey="team" tick={AXIS_TICK} width={160} />
              <Tooltip formatter={(v) => [`${v}%`, "Completion rate"]} />
              <Bar dataKey="rate" name="Completion rate" fill={ACHIEVED_GREEN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <SectionHeading>By region</SectionHeading>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VerticalBarCard
          title="Leads by region"
          data={data.regionTotals}
          dataKey="total"
          categoryKey="region"
          color="#0f62fe"
          width={110}
        />
        <Card>
          <CardHeader>
            <CardTitle>Region share</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={data.regionTotals}
                  dataKey="total"
                  nameKey="region"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {data.regionTotals.map((entry, i) => (
                    <Cell key={entry.region} fill={REGION_COLORS[i % REGION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <SectionHeading>By state</SectionHeading>
      <VerticalBarCard
        title={`Leads by state (${data.stateTotals.length} states/UTs)`}
        data={data.stateTotals}
        dataKey="total"
        categoryKey="state"
        color="#8a3ffc"
        width={140}
      />

      <SectionHeading>By district</SectionHeading>
      <VerticalBarCard
        title={`Top districts by leads (of ${data.totalDistinctDistricts} distinct districts)`}
        data={data.districtTotals}
        dataKey="total"
        categoryKey="district"
        color="#08bdba"
        width={150}
      />

      <SectionHeading>Aspirational districts</SectionHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="In aspirational districts"
          value={data.aspirational.aspirationalCount.toLocaleString("en-IN")}
          sub={`${data.aspirational.aspirationalRate}% of total`}
          achieved
        />
        <KpiCard
          label="In non-aspirational districts"
          value={data.aspirational.nonAspirationalCount.toLocaleString("en-IN")}
        />
        <KpiCard
          label="Unclassified"
          value={data.aspirational.unclassifiedCount.toLocaleString("en-IN")}
          sub="no confident district match"
        />
        <KpiCard
          label="Aspirational districts reached"
          value={data.aspirational.byDistrict.length.toLocaleString("en-IN")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aspirational vs. non-aspirational</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={[
                    { name: "Aspirational", value: data.aspirational.aspirationalCount },
                    {
                      name: "Non-aspirational",
                      value: data.aspirational.nonAspirationalCount,
                    },
                    { name: "Unclassified", value: data.aspirational.unclassifiedCount },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  <Cell fill="#24a148" />
                  <Cell fill="#c6c6c6" />
                  <Cell fill="#e5e5e5" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <VerticalBarCard
          title="Top aspirational districts by leads"
          data={data.aspirational.byDistrict}
          dataKey="total"
          categoryKey="district"
          color="#24a148"
          width={150}
        />
      </div>

      <SectionHeading>Members</SectionHeading>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VerticalBarCard
          title="Top team members by leads"
          data={data.topMembers}
          dataKey="total"
          categoryKey="member"
          color="#8a3ffc"
          width={130}
        />
        <Card>
          <CardHeader>
            <CardTitle>Members who have created a lead</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={[
                    { name: "Active", value: data.memberActive.active },
                    { name: "No leads yet", value: data.memberActive.inactive },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  <Cell fill="#24a148" />
                  <Cell fill="#c6c6c6" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <SectionHeading>Girls reach</SectionHeading>
      <Card>
        <CardHeader>
          <CardTitle>Girls reach — planned vs. reached (by team)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.girlsReachByTeam} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
              <XAxis
                dataKey="team"
                tick={AXIS_TICK}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="planned" name="Planned" fill="#c6c6c6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reached" name="Reached" fill="#24a148" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
