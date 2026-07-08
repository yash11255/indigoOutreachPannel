import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/data/session";
import { getLeads } from "@/lib/data/leads";
import { getTeams } from "@/lib/data/lookups";
import { STAGE_ORDER, STAGE_LABELS, stageForStatus, type LeadStage } from "@/lib/types";

function sum(nums: (number | null)[]) {
  return nums.reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

/** Bold white-on-blue header row, frozen, matching the app's own brand blue. */
function styleHeader(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F62FE" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

export async function GET() {
  await requireAdmin();

  const [leads, teams] = await Promise.all([getLeads(), getTeams()]);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Indigo GWF Outreach Dashboard";
  workbook.created = new Date();

  // ── Summary by team ──────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Summary by team");
  summarySheet.columns = [
    { header: "Team", key: "team", width: 28 },
    { header: "Total leads", key: "total", width: 12 },
    { header: "Planned", key: "planned", width: 10 },
    { header: "Outreach sent", key: "sent", width: 14 },
    { header: "Scheduled", key: "scheduled", width: 12 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "Stalled", key: "stalled", width: 10 },
    { header: "Planned girls reach", key: "plannedGirls", width: 18 },
    { header: "Girls reached", key: "girlsReached", width: 14 },
  ];
  styleHeader(summarySheet);

  for (const team of teams) {
    const teamLeads = leads.filter((l) => l.team_id === team.id);
    const stages: Record<LeadStage, number> = {
      planned: 0,
      outreach_sent: 0,
      scheduled: 0,
      completed: 0,
      stalled: 0,
    };
    for (const l of teamLeads) stages[stageForStatus(l.status)] += 1;
    summarySheet.addRow({
      team: team.name,
      total: teamLeads.length,
      planned: stages.planned,
      sent: stages.outreach_sent,
      scheduled: stages.scheduled,
      completed: stages.completed,
      stalled: stages.stalled,
      plannedGirls: sum(teamLeads.map((l) => l.planned_girls_reach)),
      girlsReached: sum(teamLeads.map((l) => l.girls_reached)),
    });
  }
  summarySheet.autoFilter = { from: "A1", to: "I1" };

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
  leadsSheet.autoFilter = { from: "A1", to: "X1" };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `indigo-gwf-outreach-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
