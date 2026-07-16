import ExcelJS from "exceljs";
import { requireAdminOrTeamAdmin } from "@/lib/data/session";
import { getLeads } from "@/lib/data/leads";
import { getTeams } from "@/lib/data/lookups";
import { getAllProfiles } from "@/lib/data/admin";
import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * Groups leads by a key and writes one summary row per group, in descending
 * total order. `extraEmptyGroups` — names known to exist (e.g. every team
 * member on the roster) that should still get a zero row even if they have
 * no leads at all, so someone who hasn't done anything doesn't just vanish
 * from the sheet; these always sort to the bottom, alphabetically.
 */
function addGroupedSummarySheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columnHeader: string,
  leads: Lead[],
  keyOf: (l: Lead) => string,
  extraEmptyGroups: string[] = [],
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
  for (const name of extraEmptyGroups) {
    if (!groups.has(name)) groups.set(name, []);
  }

  const sorted = Array.from(groups.entries()).sort((a, b) => {
    if (a[1].length === 0 && b[1].length === 0) return a[0].localeCompare(b[0]);
    if (a[1].length === 0) return 1;
    if (b[1].length === 0) return -1;
    return b[1].length - a[1].length;
  });
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

const DIMENSION_KEYS = [
  "date",
  "createdDate",
  "team",
  "subTeam",
  "region",
  "state",
  "district",
  "member",
  "memberEmail",
  "institution",
  "stage",
  "status",
] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  date: "Planned Date",
  createdDate: "Created Date",
  team: "Team",
  subTeam: "Sub-team",
  region: "Region",
  state: "State",
  district: "District / City",
  member: "Team Member",
  memberEmail: "Team Member Email",
  institution: "Institution",
  stage: "Stage",
  status: "Status",
};

function dimensionValue(
  l: Lead,
  dim: DimensionKey,
  teamName: (id: string) => string,
  memberEmailById: Map<string, string>,
): string {
  switch (dim) {
    case "date":
      return l.planned_date || "No planned date";
    case "createdDate":
      return createdOnDay(l.created_at);
    case "team":
      return teamName(l.team_id);
    case "subTeam":
      return l.sub_team || "(no sub-team)";
    case "region":
      return l.region || "Unspecified";
    case "state":
      return l.state || "Unspecified";
    case "district":
      return l.district_city || "Unspecified";
    case "member":
      return l.responsible_member || "Unassigned";
    case "memberEmail":
      return (l.created_by && memberEmailById.get(l.created_by)) || "Unknown";
    case "status":
      return l.status;
    case "institution":
      return l.institution_name || "Unspecified";
    case "stage":
      return STAGE_LABELS[stageForStatus(l.status)];
  }
}

/**
 * One row per unique combination of the chosen dimensions (e.g. Team x Team
 * Member gives one row per team/member pair actually in use) — a flat
 * cross-tab rather than a nested outline, so it stays simple to build
 * correctly and is still fully pivotable/filterable once in Excel.
 */
function addCustomCombinationSheet(
  workbook: ExcelJS.Workbook,
  dims: DimensionKey[],
  leads: Lead[],
  teamName: (id: string) => string,
  memberEmailById: Map<string, string>,
) {
  const sheet = workbook.addWorksheet(
    `Custom (${dims.map((d) => DIMENSION_LABELS[d]).join(" x ")})`.slice(0, 31),
  );
  sheet.columns = [
    ...dims.map((d, i) => ({ header: DIMENSION_LABELS[d], key: `dim${i}`, width: 22 })),
    { header: "Total leads", key: "total", width: 12 },
    { header: "Planned", key: "planned", width: 10 },
    { header: "Outreach sent", key: "sent", width: 14 },
    { header: "Scheduled", key: "scheduled", width: 12 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "Stalled", key: "stalled", width: 10 },
    { header: "Planned girls reach", key: "plannedGirls", width: 18 },
    { header: "Girls reached", key: "girlsReached", width: 14 },
  ];

  const groups = new Map<string, { values: string[]; rows: Lead[] }>();
  for (const l of leads) {
    const values = dims.map((d) => dimensionValue(l, d, teamName, memberEmailById));
    const key = values.join("");
    const entry = groups.get(key) ?? { values, rows: [] };
    entry.rows.push(l);
    groups.set(key, entry);
  }

  // Sort chronologically when either date dimension is picked (each is
  // always at its own fixed column position, so a plain lexicographic
  // compare works — "No planned date" sorts after any real ISO date).
  // Otherwise, most-common combination first, same as the other sheets.
  const dateIndex = dims.indexOf("date") !== -1 ? dims.indexOf("date") : dims.indexOf("createdDate");
  const sorted = Array.from(groups.values()).sort((a, b) =>
    dateIndex === -1
      ? b.rows.length - a.rows.length
      : a.values[dateIndex].localeCompare(b.values[dateIndex]) ||
        b.rows.length - a.rows.length,
  );
  for (const { values, rows } of sorted) {
    const stages = stageCounts(rows);
    const rowData: Record<string, string | number> = {};
    values.forEach((v, i) => (rowData[`dim${i}`] = v));
    rowData.total = rows.length;
    rowData.planned = stages.planned;
    rowData.sent = stages.outreach_sent;
    rowData.scheduled = stages.scheduled;
    rowData.completed = stages.completed;
    rowData.stalled = stages.stalled;
    rowData.plannedGirls = sum(rows.map((l) => l.planned_girls_reach));
    rowData.girlsReached = sum(rows.map((l) => l.girls_reached));
    sheet.addRow(rowData);
  }
  const lastCol = String.fromCharCode(65 + dims.length + 7);
  sheet.autoFilter = { from: "A1", to: `${lastCol}1` };
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
 * Reads a "sheet include" checkbox. Each one is paired with a hidden input
 * of the same name carrying "0", submitted first — a browser only adds the
 * checkbox's own "1" when it's checked, so getAll() is "0" when unchecked and
 * "0","1" when checked. Falls back to defaultValue when the param is missing
 * entirely (e.g. someone hits this route directly without going through the
 * segment page's form).
 */
function checkboxParam(
  searchParams: URLSearchParams,
  name: string,
  defaultValue: boolean,
): boolean {
  const all = searchParams.getAll(name);
  return all.length === 0 ? defaultValue : all.includes("1");
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

/** Same IST-day grouping used by the admin dashboard's "Leads by day" chart. */
function createdOnDay(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Everyone who has never signed in ("inactive" = no last_sign_in_at at all,
 * from auth.users), grouped by team, with their reporting manager resolved
 * from profiles.manager_id. Needs the service-role client since last sign-in
 * only lives in auth.users, which RLS never exposes to a regular session.
 */
async function inactiveUsersReport(restrictToTeamId: string | null): Promise<Response> {
  const admin = createAdminClient();
  const [{ data: profiles }, teams] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, team_id, manager_id, role"),
    getTeams(),
  ]);

  const lastSignIn = new Map<string, string | null>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data || data.users.length === 0) break;
    for (const u of data.users) lastSignIn.set(u.id, u.last_sign_in_at ?? null);
    if (data.users.length < 1000) break;
  }

  const teamName = (id: string | null) =>
    teams.find((t) => t.id === id)?.name ?? "(no team)";
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const inactive = (profiles ?? [])
    .filter(
      (p) =>
        (!restrictToTeamId || p.team_id === restrictToTeamId) &&
        !lastSignIn.get(p.id),
    )
    .sort(
      (a, b) =>
        teamName(a.team_id).localeCompare(teamName(b.team_id)) ||
        (a.full_name ?? "").localeCompare(b.full_name ?? ""),
    );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Indigo GWF Outreach Dashboard";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Inactive users");
  sheet.columns = [
    { header: "Team", key: "team", width: 22 },
    { header: "Name", key: "name", width: 24 },
    { header: "Email", key: "email", width: 30 },
    { header: "Role", key: "role", width: 12 },
    { header: "Reporting Manager", key: "manager", width: 24 },
    { header: "Manager Email", key: "managerEmail", width: 30 },
  ];
  for (const p of inactive) {
    const manager = p.manager_id ? profileById.get(p.manager_id) : null;
    sheet.addRow({
      team: teamName(p.team_id),
      name: p.full_name || "(no name)",
      email: p.email,
      role: p.role,
      manager: manager?.full_name || (p.manager_id ? "(unknown)" : "—"),
      managerEmail: manager?.email || "—",
    });
  }
  sheet.autoFilter = { from: "A1", to: "F1" };
  styleSheet(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inactive-users-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

export async function GET(request: Request) {
  const profile = await requireAdminOrTeamAdmin();
  const isFullAdmin = profile.role === "admin";

  const { searchParams } = new URL(request.url);

  if (searchParams.get("report") === "inactive") {
    return inactiveUsersReport(profile.role === "admin" ? null : profile.team_id);
  }

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
  const filterCreatedOn = parseDateParam(searchParams.get("createdOn"));
  const filterFrom = parseDateParam(searchParams.get("from"));
  const filterTo = parseDateParam(searchParams.get("to"));
  const includeTeam = checkboxParam(searchParams, "includeTeam", true);
  const includeState = checkboxParam(searchParams, "includeState", true);
  const includeDistrict = checkboxParam(searchParams, "includeDistrict", true);
  const includeMember = checkboxParam(searchParams, "includeMember", true);
  // Comma-separated stage keys, e.g. "outreach_sent,scheduled" for an
  // "in progress" preset that spans more than one canonical stage.
  const filterStages = searchParams.get("stages")?.split(",").filter(Boolean) as
    | LeadStage[]
    | undefined;
  // Custom sheet: any combination of dimensions the user checked. Each
  // checked box is its own "groupBy=<key>" entry (same name, repeated) —
  // getAll(), not get()+split(), since a comma-joined single value would
  // only ever capture the first checkbox a browser sends.
  const customGroupBy = searchParams.getAll("groupBy") as DimensionKey[];
  // Column picker for the "All leads" raw sheet, same repeated-param shape.
  // Omitted entirely (getAll returns []) means "everything" — so a direct
  // hit on this route without going through the admin page's form still
  // gets the full sheet it always used to.
  const columnsParamValues = searchParams.getAll("columns");
  const selectedColumns =
    columnsParamValues.length > 0 ? new Set(columnsParamValues) : null;

  const [allLeads, teams, profiles] = await Promise.all([
    getLeads(),
    getTeams(),
    getAllProfiles(),
  ]);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";
  const memberEmailById = new Map(profiles.map((p) => [p.id, p.email]));

  const leads = allLeads.filter(
    (l) =>
      (!filterRegion || l.region === filterRegion) &&
      (!filterTeamId || l.team_id === filterTeamId) &&
      (!filterSubTeam || l.sub_team === filterSubTeam) &&
      (!filterState || l.state === filterState) &&
      (!filterDistrict || l.district_city === filterDistrict) &&
      (!filterCreatedOn || createdOnDay(l.created_at) === filterCreatedOn) &&
      (!filterStages?.length || filterStages.includes(stageForStatus(l.status))) &&
      withinDateRange(l, filterFrom, filterTo),
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Indigo GWF Outreach Dashboard";
  workbook.created = new Date();

  // ── Report info (cover sheet) ───────────────────────────────────────
  const scopeLine =
    [
      filterRegion,
      filterState,
      filterDistrict,
      filterTeamId && teamName(filterTeamId),
      filterSubTeam,
      filterCreatedOn && `Created ${filterCreatedOn}`,
      filterStages?.length &&
        `Stage: ${filterStages.map((s) => STAGE_LABELS[s]).join(" + ")}`,
    ]
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

  // Each breakdown is opt-out via its checkbox on the segment page (defaults
  // checked), and additionally skipped when the export is already filtered
  // down to a single value on that same dimension — a "by team" sheet with
  // one row isn't useful once you've already picked a team.
  if (includeTeam && !filterTeamId) {
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
  if (includeState && !filterState) {
    addGroupedSummarySheet(
      workbook,
      "Summary by state",
      "State",
      leads,
      (l) => l.state ?? "",
    );
  }
  if (includeDistrict && !filterDistrict) {
    addGroupedSummarySheet(
      workbook,
      "Summary by district",
      "District / City",
      leads,
      (l) => l.district_city ?? "",
    );
  }
  // "Who created these" is always worth its own sheet once a single day is
  // selected, regardless of the checkbox — otherwise it follows the checkbox.
  if (includeMember || filterCreatedOn) {
    // Append everyone assigned to the team(s) in scope who has zero leads,
    // so they still show up (at the bottom) instead of silently vanishing —
    // skipped for a single-day report, where "who did nothing today" isn't
    // the point and would just be almost the entire roster.
    const zeroLeadRoster = filterCreatedOn
      ? []
      : profiles
          .filter((p) => !filterTeamId || p.team_id === filterTeamId)
          .map((p) => p.full_name || p.email);
    addGroupedSummarySheet(
      workbook,
      "Summary by team member",
      "Responsible member",
      leads,
      (l) => l.responsible_member ?? "",
      zeroLeadRoster,
    );
  }

  // ── Custom sheet: any combination of dimensions the user picked ─────
  if (customGroupBy.length > 0) {
    addCustomCombinationSheet(workbook, customGroupBy, leads, teamName, memberEmailById);
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
  const ALL_LEAD_COLUMNS = [
    { header: "Institution", key: "institution", width: 34 },
    { header: "Created date", key: "createdDate", width: 13 },
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
  ] as const;
  // Column picker from the admin page's "All leads columns" checkboxes —
  // omitted params param means "everything" (unchanged default behaviour).
  const activeColumns = selectedColumns
    ? ALL_LEAD_COLUMNS.filter((c) => selectedColumns.has(c.key))
    : ALL_LEAD_COLUMNS;
  leadsSheet.columns = activeColumns.map((c) => ({ ...c }));

  for (const l of leads) {
    leadsSheet.addRow({
      institution: l.institution_name,
      createdDate: new Date(`${createdOnDay(l.created_at)}T00:00:00`),
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
  if (activeColumns.some((c) => c.key === "createdDate")) {
    leadsSheet.getColumn("createdDate").numFmt = "dd-mmm-yyyy";
  }
  if (activeColumns.some((c) => c.key === "plannedDate")) {
    leadsSheet.getColumn("plannedDate").numFmt = "dd-mmm-yyyy";
  }
  if (activeColumns.some((c) => c.key === "executedDate")) {
    leadsSheet.getColumn("executedDate").numFmt = "dd-mmm-yyyy";
  }
  if (activeColumns.length > 0) {
    const lastCol = String.fromCharCode(
      activeColumns.length <= 26 ? 64 + activeColumns.length : 64,
    );
    leadsSheet.autoFilter = { from: "A1", to: `${lastCol}1` };
  }
  styleSheet(leadsSheet, { freezeFirstColumn: true });

  const buffer = await workbook.xlsx.writeBuffer();
  const scopeParts = [
    filterRegion,
    filterState,
    filterDistrict,
    filterTeamId && teamName(filterTeamId),
    filterSubTeam,
    filterCreatedOn,
    filterFrom,
    filterTo,
    filterStages?.join("+"),
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
