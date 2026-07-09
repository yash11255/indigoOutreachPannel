import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/data/session";
import { getLeads } from "@/lib/data/leads";
import { getTeams } from "@/lib/data/lookups";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  stageForStatus,
  type LeadStage,
  type Lead,
} from "@/lib/types";

function sum(nums: (number | null)[]) {
  return nums.reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

function stageCounts(rows: Lead[]) {
  const stages: Record<LeadStage, number> = {
    planned: 0,
    outreach_sent: 0,
    scheduled: 0,
    completed: 0,
    stalled: 0,
  };
  for (const l of rows) stages[stageForStatus(l.status)] += 1;
  return stages;
}

/** Groups leads by a key and writes one summary row per group, in descending total order. */
function addGroupedSummarySheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columnHeader: string,
  leads: Lead[],
  keyOf: (l: Lead) => string,
) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { header: columnHeader, key: "group", width: 24 },
    { header: "Total leads", key: "total", width: 12 },
    { header: "Planned", key: "planned", width: 10 },
    { header: "Outreach sent", key: "sent", width: 14 },
    { header: "Scheduled", key: "scheduled", width: 12 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "Stalled", key: "stalled", width: 10 },
    { header: "Planned girls reach", key: "plannedGirls", width: 18 },
    { header: "Girls reached", key: "girlsReached", width: 14 },
  ];
  styleHeader(sheet);

  const groups = new Map<string, Lead[]>();
  for (const l of leads) {
    const key = keyOf(l) || "Unspecified";
    const arr = groups.get(key) ?? [];
    arr.push(l);
    groups.set(key, arr);
  }

  const sorted = Array.from(groups.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );
  for (const [group, rows] of sorted) {
    const stages = stageCounts(rows);
    sheet.addRow({
      group,
      total: rows.length,
      planned: stages.planned,
      sent: stages.outreach_sent,
      scheduled: stages.scheduled,
      completed: stages.completed,
      stalled: stages.stalled,
      plannedGirls: sum(rows.map((l) => l.planned_girls_reach)),
      girlsReached: sum(rows.map((l) => l.girls_reached)),
    });
  }
  sheet.autoFilter = { from: "A1", to: "I1" };
}

/** Bold white-on-blue header row, frozen, matching the app's own brand blue. */
function styleHeader(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F62FE" },
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

export async function GET(request: Request) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const filterRegion = searchParams.get("region");
  const filterTeamId = searchParams.get("team");
  const filterSubTeam = searchParams.get("subTeam");

  const [allLeads, teams] = await Promise.all([getLeads(), getTeams()]);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";

  const leads = allLeads.filter(
    (l) =>
      (!filterRegion || l.region === filterRegion) &&
      (!filterTeamId || l.team_id === filterTeamId) &&
      (!filterSubTeam || l.sub_team === filterSubTeam),
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Indigo GWF Outreach Dashboard";
  workbook.created = new Date();

  // Skip a breakdown sheet when the export is already filtered down to a
  // single value on that same dimension — a "by team" sheet with one row
  // isn't useful once you've already picked a team.
  if (!filterTeamId) {
    addGroupedSummarySheet(workbook, "Summary by team", "Team", leads, (l) =>
      teamName(l.team_id),
    );
  }
  if (!filterRegion) {
    addGroupedSummarySheet(
      workbook,
      "Summary by region",
      "Region",
      leads,
      (l) => l.region ?? "",
    );
  }
  addGroupedSummarySheet(
    workbook,
    "Summary by state",
    "State",
    leads,
    (l) => l.state ?? "",
  );

  // ── By stage (matches the dashboard's stat cards) ───────────────────
  const stageSheet = workbook.addWorksheet("By stage");
  stageSheet.columns = [
    { header: "Stage", key: "stage", width: 16 },
    { header: "Total leads", key: "total", width: 12 },
  ];
  styleHeader(stageSheet);
  for (const stage of STAGE_ORDER) {
    stageSheet.addRow({
      stage: STAGE_LABELS[stage],
      total: leads.filter((l) => stageForStatus(l.status) === stage).length,
    });
  }

  // ── Every lead ───────────────────────────────────────────────────────
  const leadsSheet = workbook.addWorksheet("All leads");
  leadsSheet.columns = [
    { header: "Institution", key: "institution", width: 34 },
    { header: "Team", key: "team", width: 20 },
    { header: "Sub-team", key: "subTeam", width: 20 },
    { header: "Region", key: "region", width: 12 },
    { header: "State", key: "state", width: 16 },
    { header: "District / City", key: "district", width: 18 },
    { header: "Hobli / Taluk", key: "hobli", width: 16 },
    { header: "Outreach Pillar", key: "pillar", width: 22 },
    { header: "Outreach Channel", key: "channel", width: 26 },
    { header: "Outreach Mode", key: "mode", width: 14 },
    { header: "Contact person", key: "contact", width: 20 },
    { header: "Designation", key: "designation", width: 20 },
    { header: "Mobile", key: "mobile", width: 14 },
    { header: "Email", key: "email", width: 26 },
    { header: "Responsible member", key: "member", width: 20 },
    { header: "Planned activity", key: "plannedActivity", width: 26 },
    { header: "Planned date", key: "plannedDate", width: 13 },
    { header: "Total students", key: "totalStudents", width: 13 },
    { header: "Planned girls reach", key: "plannedGirls", width: 16 },
    { header: "Executed date", key: "executedDate", width: 13 },
    { header: "Activity undertaken", key: "activityUndertaken", width: 26 },
    { header: "Girls reached", key: "girlsReached", width: 13 },
    { header: "Status", key: "status", width: 20 },
    { header: "Drive link", key: "driveLink", width: 30 },
    { header: "Remarks", key: "remarks", width: 34 },
  ];
  styleHeader(leadsSheet);

  for (const l of leads) {
    leadsSheet.addRow({
      institution: l.institution_name,
      team: teamName(l.team_id),
      subTeam: l.sub_team,
      region: l.region,
      state: l.state,
      district: l.district_city,
      hobli: l.hobli,
      pillar: l.institution_type,
      channel: l.institution_channel,
      mode: l.outreach_mode,
      contact: l.contact_person,
      designation: l.designation,
      mobile: l.mobile_no,
      email: l.email_id,
      member: l.responsible_member,
      plannedActivity: l.planned_activity,
      plannedDate: l.planned_date,
      totalStudents: l.no_of_institutions,
      plannedGirls: l.planned_girls_reach,
      executedDate: l.executed_date,
      activityUndertaken: l.activity_undertaken,
      girlsReached: l.girls_reached,
      status: l.status,
      driveLink: l.drive_link,
      remarks: l.remarks,
    });
  }
  leadsSheet.autoFilter = { from: "A1", to: "Y1" };

  const buffer = await workbook.xlsx.writeBuffer();
  const scopeParts = [
    filterRegion,
    filterTeamId && teamName(filterTeamId),
    filterSubTeam,
  ].filter(Boolean);
  const scopeSuffix = scopeParts.length
    ? `-${scopeParts.join("-").replace(/[^a-zA-Z0-9-]+/g, "_")}`
    : "";
  const filename = `indigo-gwf-outreach${scopeSuffix}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
