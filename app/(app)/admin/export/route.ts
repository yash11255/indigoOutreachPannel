import ExcelJS from "exceljs";
import { requireAdminOrTeamAdmin } from "@/lib/data/session";
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
  styleSheet(sheet);
}

const THIN_BORDER: Partial<ExcelJS.Border> = {
  style: "thin",
  color: { argb: "FFE0E3E8" },
};

/**
 * Bold white-on-blue header row (frozen), thin borders and light zebra
 * striping on the data rows below it, matching the app's own brand blue.
 * Call once per sheet after all rows have been added.
 */
function styleSheet(
  sheet: ExcelJS.Worksheet,
  opts: { freezeFirstColumn?: boolean } = {},
) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F62FE" },
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 20;
  sheet.views = [
    { state: "frozen", ySplit: 1, xSplit: opts.freezeFirstColumn ? 1 : 0 },
  ];

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: THIN_BORDER,
        left: THIN_BORDER,
        bottom: THIN_BORDER,
        right: THIN_BORDER,
      };
    });
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF4F7FF" },
        };
      });
    }
  });
}

/** Validates a "YYYY-MM-DD" param, or returns null if blank/malformed. */
function parseDateParam(v: string | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * True if a lead's planned or executed date falls within [from, to] (either
 * bound optional). Compared as plain "YYYY-MM-DD" strings — they sort
 * lexicographically the same as chronologically, so this sidesteps any
 * timezone conversion entirely.
 */
function withinDateRange(lead: Lead, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  const dates = [lead.planned_date, lead.executed_date].filter((d): d is string => !!d);
  if (dates.length === 0) return false;
  return dates.some((d) => (!from || d >= from) && (!to || d <= to));
}

export async function GET(request: Request) {
  const profile = await requireAdminOrTeamAdmin();
  const isFullAdmin = profile.role === "admin";

  const { searchParams } = new URL(request.url);
  // A team_admin can only ever export their own team — region spans
  // multiple teams, so that's not a meaningful scope for them either. If
  // they're also scoped to one sub-division, force that too rather than
  // letting a query param widen it back to the whole team.
  const filterRegion = isFullAdmin ? searchParams.get("region") : null;
  const filterTeamId = isFullAdmin ? searchParams.get("team") : profile.team_id;
  const filterSubTeam =
    !isFullAdmin && profile.sub_team ? profile.sub_team : searchParams.get("subTeam");
  const filterState = searchParams.get("state");
  const filterDistrict = searchParams.get("district");
  const filterFrom = parseDateParam(searchParams.get("from"));
  const filterTo = parseDateParam(searchParams.get("to"));

  const [allLeads, teams] = await Promise.all([getLeads(), getTeams()]);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";

  const leads = allLeads.filter(
    (l) =>
      (!filterRegion || l.region === filterRegion) &&
      (!filterTeamId || l.team_id === filterTeamId) &&
      (!filterSubTeam || l.sub_team === filterSubTeam) &&
      (!filterState || l.state === filterState) &&
      (!filterDistrict || l.district_city === filterDistrict) &&
      withinDateRange(l, filterFrom, filterTo),
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Indigo GWF Outreach Dashboard";
  workbook.created = new Date();

  // ── Report info (cover sheet) ───────────────────────────────────────
  const scopeLine =
    [filterRegion, filterState, filterDistrict, filterTeamId && teamName(filterTeamId), filterSubTeam]
      .filter(Boolean)
      .join(" — ") || "All teams and regions";
  const dateRangeLine =
    filterFrom || filterTo
      ? `${filterFrom ?? "the beginning"} to ${filterTo ?? "now"}`
      : "All dates";

  const infoSheet = workbook.addWorksheet("Report info");
  infoSheet.properties.tabColor = { argb: "FF0F62FE" };
  infoSheet.columns = [
    { key: "label", width: 20 },
    { key: "value", width: 50 },
  ];
  infoSheet.addRow(["Indigo GWF Outreach — Export"]);
  infoSheet.mergeCells("A1:B1");
  infoSheet.getCell("A1").font = {
    bold: true,
    size: 14,
    color: { argb: "FF0F62FE" },
  };
  infoSheet.addRow([]);
  infoSheet.addRow(["Scope", scopeLine]);
  infoSheet.addRow(["Date range (planned/executed)", dateRangeLine]);
  infoSheet.addRow(["Total leads", leads.length]);
  infoSheet.addRow([
    "Generated",
    new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  ]);
  for (let r = 3; r <= 6; r++) {
    infoSheet.getCell(`A${r}`).font = {
      bold: true,
      color: { argb: "FF4A5361" },
    };
  }

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
  if (!filterState) {
    addGroupedSummarySheet(
      workbook,
      "Summary by state",
      "State",
      leads,
      (l) => l.state ?? "",
    );
  }
  if (!filterDistrict) {
    addGroupedSummarySheet(
      workbook,
      "Summary by district",
      "District / City",
      leads,
      (l) => l.district_city ?? "",
    );
  }

  // ── By stage (matches the dashboard's stat cards) ───────────────────
  const stageSheet = workbook.addWorksheet("By stage");
  stageSheet.columns = [
    { header: "Stage", key: "stage", width: 16 },
    { header: "Total leads", key: "total", width: 12 },
  ];
  for (const stage of STAGE_ORDER) {
    stageSheet.addRow({
      stage: STAGE_LABELS[stage],
      total: leads.filter((l) => stageForStatus(l.status) === stage).length,
    });
  }
  styleSheet(stageSheet);

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
      plannedDate: l.planned_date
        ? new Date(`${l.planned_date}T00:00:00`)
        : null,
      totalStudents: l.no_of_institutions,
      plannedGirls: l.planned_girls_reach,
      executedDate: l.executed_date
        ? new Date(`${l.executed_date}T00:00:00`)
        : null,
      activityUndertaken: l.activity_undertaken,
      girlsReached: l.girls_reached,
      status: l.status,
      driveLink: l.drive_link,
      remarks: l.remarks,
    });
  }
  leadsSheet.getColumn("plannedDate").numFmt = "dd-mmm-yyyy";
  leadsSheet.getColumn("executedDate").numFmt = "dd-mmm-yyyy";
  leadsSheet.autoFilter = { from: "A1", to: "Y1" };
  styleSheet(leadsSheet, { freezeFirstColumn: true });

  const buffer = await workbook.xlsx.writeBuffer();
  const scopeParts = [
    filterRegion,
    filterState,
    filterDistrict,
    filterTeamId && teamName(filterTeamId),
    filterSubTeam,
    filterFrom,
    filterTo,
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
