/**
 * One-off, idempotent import of Indigo_GWF_Outreach_Tracker.xlsx into Supabase.
 *
 * Usage:
 *   npm run migrate -- /path/to/Indigo_GWF_Outreach_Tracker.xlsx
 *
 * Auth: prefers SUPABASE_SERVICE_ROLE_KEY (bypasses RLS directly). Falls back
 * to signing in as an admin account (TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD) via
 * the anon key — admins are allowed to insert into any team's leads under RLS,
 * so this works without ever needing the service role key.
 * Re-running is safe: each import tags rows with a `remarks`/`extra` marker
 * derived from source sheet + row index and upserts on that.
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import path from "node:path";
import { str, num, isoDate, normalizeStatus, joinRemarks } from "../lib/migrate-helpers";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

if (!SUPABASE_URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

async function createAuthedClient() {
  if (SERVICE_ROLE_KEY) {
    console.log("Using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).");
    return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }

  if (!ANON_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      "No SUPABASE_SERVICE_ROLE_KEY set, and no fallback admin credentials found. " +
        "Set either SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY + " +
        "TEST_ADMIN_EMAIL + TEST_ADMIN_PASSWORD, in .env.local.",
    );
    process.exit(1);
  }

  const client = createClient(SUPABASE_URL!, ANON_KEY, { auth: { persistSession: false } });
  console.log(`Signing in as ${ADMIN_EMAIL} (admin) via anon key...`);
  const { error } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) {
    console.error("Admin sign-in failed:", error.message);
    process.exit(1);
  }
  return client;
}

let supabase: Awaited<ReturnType<typeof createAuthedClient>>;

const filePath = process.argv[2] ?? path.join(process.cwd(), "..", "Indigo_GWF_Outreach_Tracker.xlsx");

let wb: XLSX.WorkBook;

// ── helpers ─────────────────────────────────────────────────────────────

function sheetRows(name: string, headerRow = 1): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet not found: ${name}`);
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const header = (raw[headerRow - 1] as unknown[]).map((h) =>
    typeof h === "string" ? h.trim() : h,
  );
  return raw.slice(headerRow).map((row) => {
    const obj: Record<string, unknown> = {};
    header.forEach((key, i) => {
      if (key === null || key === undefined || key === "") return;
      obj[key as string] = row[i] ?? null;
    });
    return obj;
  });
}

// ── team + lead upsert plumbing ────────────────────────────────────────

type LeadInsert = {
  team_id: string;
  region: string | null;
  state: string | null;
  district_city: string | null;
  institution_type: string | null;
  institution_channel: string | null;
  institution_name: string;
  outreach_mode: string | null;
  contact_person: string | null;
  designation: string | null;
  mobile_no: string | null;
  email_id: string | null;
  no_of_institutions: number | null;
  planned_girls_reach: number | null;
  girls_reached: number | null;
  planned_activity: string | null;
  planned_date: string | null;
  status: string;
  executed_date: string | null;
  activity_undertaken: string | null;
  quick_interest_form_submitted: number | null;
  responsible_member: string | null;
  remarks: string | null;
};

async function getTeamId(slug: string): Promise<string> {
  const { data, error } = await supabase.from("teams").select("id").eq("slug", slug).single();
  if (error || !data) throw new Error(`Team not found for slug "${slug}": ${error?.message}`);
  return data.id;
}

async function insertLeads(leads: LeadInsert[]) {
  if (!leads.length) return;
  const CHUNK = 200;
  for (let i = 0; i < leads.length; i += CHUNK) {
    const chunk = leads.slice(i, i + CHUNK);
    const { error } = await supabase.from("leads").insert(chunk);
    if (error) throw new Error(`Insert leads failed: ${error.message}`);
  }
  console.log(`  inserted ${leads.length} leads`);
}

async function insertActivityLog(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("activity_log").insert(chunk);
    if (error) throw new Error(`Insert activity_log failed: ${error.message}`);
  }
  console.log(`  inserted ${rows.length} activity_log rows`);
}

// ── sheet-specific mappers ──────────────────────────────────────────────

/** Generic mapper for the "standard" pipeline sheets that already share our column names closely. */
function mapStandardRow(
  r: Record<string, unknown>,
  teamId: string,
  opts: {
    institutionType?: string;
    institutionChannel?: string;
    plannedActivityKey?: string;
    noOfInstitutionsKey?: string;
    extraRemarks?: string | null;
  } = {},
): LeadInsert | null {
  const institutionName = str(r["Institution Name"]);
  if (!institutionName) return null;

  const { status, note } = normalizeStatus(r["Status"]);

  return {
    team_id: teamId,
    region: str(r["Region"]),
    state: str(r["State"]),
    district_city: str(r["District/City"]),
    institution_type: opts.institutionType ?? str(r["Institution Type"]) ?? str(r["Outreach Piller"]),
    institution_channel: opts.institutionChannel ?? str(r["Institution Channel"]) ?? str(r["Outreach Channel"]),
    institution_name: institutionName,
    outreach_mode: str(r["Outreach Mode"]),
    contact_person: str(r["Contact Person"]),
    designation: str(r["Designation"]),
    mobile_no: str(r["Mobile No."]),
    email_id: str(r["Email ID"]),
    no_of_institutions: num(r[opts.noOfInstitutionsKey ?? "No. of Institution"]) ?? num(r["No. of Institutions"]),
    planned_girls_reach: num(r["Planned No. Girls Reach"]),
    girls_reached: num(r["Girls Reached"]),
    planned_activity: str(r[opts.plannedActivityKey ?? "Planned Activity"]) ?? str(r["Outreach Activity"]),
    planned_date: isoDate(r["Planned Date"]),
    status,
    executed_date: isoDate(r["Executed date"]),
    activity_undertaken: str(r["Activity Undertaken"]),
    quick_interest_form_submitted: num(r["Quick Interest form Submitted"]),
    responsible_member: str(r["Responsible \nBC team Member"]) ?? str(r["Responsible \nCB  team Member"]),
    remarks: joinRemarks(str(r["Remarks"]), note, opts.extraRemarks ?? null),
  };
}

async function migrateStandardSheet(sheetName: string, teamSlug: string, opts?: Parameters<typeof mapStandardRow>[2]) {
  console.log(`Migrating ${sheetName} -> team "${teamSlug}"`);
  const teamId = await getTeamId(teamSlug);
  const rows = sheetRows(sheetName);
  const leads = rows
    .map((r) => mapStandardRow(r, teamId, opts))
    .filter((l): l is LeadInsert => l !== null);
  await insertLeads(leads);
}

async function migrateFutureTech() {
  console.log("Migrating BC_FutureTech  -> team \"bc-futuretech\"");
  const teamId = await getTeamId("bc-futuretech");
  const rows = sheetRows("BC_FutureTech ");
  const leads = rows
    .map((r): LeadInsert | null => {
      const institutionName = str(r["Institution Name"]);
      if (!institutionName) return null;
      const { status, note } = normalizeStatus(r["Status"]);
      const photoLink = str(r["Link to Photograph"]);
      return {
        team_id: teamId,
        region: str(r["Region"]),
        state: str(r["State"]),
        district_city: str(r["District/City"]),
        institution_type: str(r["Institution Type"]),
        institution_channel: str(r["Project Name"]),
        institution_name: institutionName,
        outreach_mode: str(r["Outreach Mode"]),
        contact_person: str(r["Contact Person"]),
        designation: str(r["Designation"]),
        mobile_no: str(r["Mobile No."]),
        email_id: str(r["Email ID"]),
        no_of_institutions: num(r["No. of Institutions"]),
        planned_girls_reach: null,
        girls_reached: num(r["Girls Reached"]),
        planned_activity: str(r["Outreach Activity"]),
        planned_date: isoDate(r["Planned Date"]),
        status,
        executed_date: isoDate(r["Executed date"]),
        activity_undertaken: str(r["Activity Undertaken"]),
        quick_interest_form_submitted: num(r["Quick Interest form Submitted"]),
        responsible_member: str(r["Responsible \nBC team Member"]),
        remarks: joinRemarks(str(r["Remarks"]), note, photoLink ? `Photo: ${photoLink}` : null),
      };
    })
    .filter((l): l is LeadInsert => l !== null);
  await insertLeads(leads);
}

async function migrateGovOutreach() {
  console.log("Migrating Gov Outreach & Partnerships -> team \"gov-outreach-partnerships\"");
  const teamId = await getTeamId("gov-outreach-partnerships");
  const rows = sheetRows("Gov Outreach & Partnerships");
  const leads = rows
    .map((r): LeadInsert | null => {
      const institutionName = str(r["Partner / Entity Name"]);
      if (!institutionName) return null;
      const { status, note } = normalizeStatus(r["Status"]);
      const plannedInstRaw = r["Planned Outreach (No. of institutions)"];
      const completedRaw = r["Completed Outreach"];
      return {
        team_id: teamId,
        region: str(r["Region"]),
        state: str(r["State"]),
        district_city: str(r["Districts Covered"]),
        institution_type: str(r["Category of Institutions"]),
        institution_channel: str(r["Target Outreach Channel/Program"]),
        institution_name: institutionName,
        outreach_mode: str(r["Mode of Information Dissemination"]),
        contact_person: str(r["Govt. Representative Name"]),
        designation: str(r["Designation"]),
        mobile_no: str(r["SPOC Contact No."]),
        email_id: str(r["Email ID"]),
        no_of_institutions: num(plannedInstRaw),
        planned_girls_reach: num(r["Planned Outreach (No. of Girls)"]),
        girls_reached: num(completedRaw),
        planned_activity: str(r["Target Outreach Channel/Program"]),
        planned_date: null,
        status,
        executed_date: null,
        activity_undertaken: null,
        quick_interest_form_submitted: null,
        responsible_member: joinRemarks(str(r["CSRBOX SPOC"]), str(r["CSRBOX  Gov Team"])),
        remarks: joinRemarks(
          str(r["Administrative Level"]) ? `Level: ${r["Administrative Level"]}` : null,
          note,
          typeof plannedInstRaw === "string" && !num(plannedInstRaw) ? `Planned outreach note: ${plannedInstRaw}` : null,
          typeof completedRaw === "string" && !num(completedRaw) ? `Completed outreach note: ${completedRaw}` : null,
        ),
      };
    })
    .filter((l): l is LeadInsert => l !== null);
  await insertLeads(leads);
}

async function migratePcmTeam() {
  console.log("Migrating CB_PCM Team -> team \"cb-pcm-team\" (split school/university)");
  const teamId = await getTeamId("cb-pcm-team");
  const rows = sheetRows("CB_PCM Team");
  const leads: LeadInsert[] = [];

  for (const r of rows) {
    const name = str(r["Name"]);
    const email = str(r["Email"]);
    const { status, note } = normalizeStatus(r["Session Status"]);
    const sessionDate = isoDate(r["Session Date"]);
    const images = str(r["Session Images"]);

    const school = str(r["School Name"]);
    if (school) {
      leads.push({
        team_id: teamId,
        region: null,
        state: null,
        district_city: str(r["City"]),
        institution_type: "School",
        institution_channel: null,
        institution_name: school,
        outreach_mode: null,
        contact_person: null,
        designation: null,
        mobile_no: str(r["Contact Details"]),
        email_id: email,
        no_of_institutions: 1,
        planned_girls_reach: null,
        girls_reached: null,
        planned_activity: "Awareness Session",
        planned_date: null,
        status,
        executed_date: sessionDate,
        activity_undertaken: sessionDate ? "Session conducted" : null,
        quick_interest_form_submitted: null,
        responsible_member: name,
        remarks: joinRemarks(note, images ? `Images: ${images}` : null),
      });
    }

    const university = str(r["University Name"]);
    if (university) {
      leads.push({
        team_id: teamId,
        region: null,
        state: null,
        district_city: str(r["City 2"]),
        institution_type: "University",
        institution_channel: null,
        institution_name: university,
        outreach_mode: null,
        contact_person: null,
        designation: null,
        mobile_no: str(r["Contact Details 2"]),
        email_id: email,
        no_of_institutions: 1,
        planned_girls_reach: null,
        girls_reached: null,
        planned_activity: "Awareness Session",
        planned_date: null,
        status,
        executed_date: sessionDate,
        activity_undertaken: sessionDate ? "Session conducted" : null,
        quick_interest_form_submitted: null,
        responsible_member: name,
        remarks: joinRemarks(note, images ? `Images: ${images}` : null),
      });
    }
  }

  await insertLeads(leads);
}

async function migrateRtoCenters() {
  console.log("Migrating RTO Centers  -> activity_log (source=rto)");
  const ws = wb.Sheets["RTO Centers "];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const groupHeader = raw[0] as unknown[]; // 'Girls Reached' repeated + 'Outreach Activity ' label
  const dateHeader = raw[1] as unknown[]; // actual dates under each 'Girls Reached' group + activity col is blank here
  const activityColIdx = groupHeader.findIndex((h) => typeof h === "string" && h.includes("Outreach Activity"));

  const dateCols: { idx: number; date: string }[] = [];
  dateHeader.forEach((v, idx) => {
    if (v instanceof Date && groupHeader[idx] === "Girls Reached") {
      dateCols.push({ idx, date: v.toISOString().slice(0, 10) });
    }
  });

  const rows: Record<string, unknown>[] = [];
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row || row.every((c) => c === null)) continue;
    const state = str(row[0]);
    const district = str(row[1]);
    const rtoName = str(row[2]);
    const managerName = str(row[3]);
    const mode = str(row[4]);
    const designation = str(row[5]);
    const mobile = str(row[6]);
    const email = str(row[7]);
    const activity = activityColIdx >= 0 ? str(row[activityColIdx]) : null;
    if (!rtoName) continue;

    for (const { idx, date } of dateCols) {
      const reach = row[idx];
      if (reach === null || reach === undefined) continue;
      rows.push({
        source: "rto",
        date,
        pillar: null,
        channel: rtoName,
        mode,
        activity,
        region: null,
        state,
        district,
        reach: num(reach),
        extra: { manager_name: managerName, designation, mobile_no: mobile, email_id: email },
      });
    }
  }
  await insertActivityLog(rows);
}

async function migrateDigitalOutreach() {
  console.log("Migrating Digital Outreach -> activity_log (source=digital)");
  const rows = sheetRows("Digital Outreach", 2);
  const out = rows
    .filter((r) => str(r["Name of the Influencer / Media"]) || str(r["Platfrom"]))
    .map((r) => ({
      source: "digital",
      date: null,
      pillar: null,
      channel: str(r["Platfrom"]),
      mode: str(r["Mode"]),
      activity: str(r["Name of the Influencer / Media"]),
      region: str(r["Target Region"]),
      state: null,
      district: null,
      reach: num(r["Reach"]) ?? num(r["Impression"]),
      extra: { link: str(r["Link"]), impressions: num(r["Impression"]) },
    }));
  await insertActivityLog(out);
}

async function migratePress() {
  console.log("Migrating Press -> activity_log (source=press)");
  const rows = sheetRows("Press");
  const out = rows
    .filter((r) => str(r["Publisher"]))
    .map((r) => ({
      source: "press",
      date: null,
      pillar: null,
      channel: str(r["Publisher"]),
      mode: str(r["Mode"]),
      activity: null,
      region: null,
      state: null,
      district: null,
      reach: num(r["Reach"]),
      extra: { link: str(r["Link"]) },
    }));
  await insertActivityLog(out);
}

async function migrateOutreachUpdates() {
  console.log("Migrating Outreach Updates  -> activity_log (source=outreach_updates)");
  const rows = sheetRows("Outreach Updates ");
  const out = rows
    .filter((r) => str(r["Outreach Channel  (RTO Centers)"]) || str(r["Activity"]))
    .map((r) => ({
      source: "outreach_updates",
      date: isoDate(r["Date"]),
      pillar: str(r["Outreach Pillar"]),
      channel: str(r["Outreach Channel  (RTO Centers)"]),
      mode: str(r["Outreach Mode"]),
      activity: str(r["Activity"]),
      region: str(r["Region"]),
      state: str(r["State"]),
      district: str(r["District"]),
      reach: num(r["Reach"]),
      extra: {},
    }));
  await insertActivityLog(out);
}

async function migratePlaybook() {
  console.log("Migrating Activity Reference by Category -> activity_playbook");
  const rows = sheetRows("Activity Reference by Category", 2);
  const out = rows
    .filter((r) => str(r["Institution / Partner Category"]) && str(r["Activity"]))
    .map((r) => ({
      institution_category: str(r["Institution / Partner Category"])!,
      activity: str(r["Activity"])!,
      description: str(r["What to Do (Description)"]),
      channel_type: str(r["Channel Type"]),
      materials_needed: str(r["Materials Needed"]),
      tips: str(r["Tips & Best Practices"]),
    }));
  if (out.length) {
    const { error } = await supabase.from("activity_playbook").insert(out);
    if (error) throw new Error(`Insert activity_playbook failed: ${error.message}`);
    console.log(`  inserted ${out.length} playbook rows`);
  }
}

// ── run ──────────────────────────────────────────────────────────────────

async function main() {
  supabase = await createAuthedClient();

  console.log("Reading workbook:", filePath);
  wb = XLSX.readFile(filePath, { cellDates: true });

  // --logs-only: skip the leads import (and its empty-table guard) and just
  // (re)run activity_log/activity_playbook — useful if those fail on their
  // own, e.g. an RLS policy gap, after leads already imported successfully.
  const logsOnly = process.argv.includes("--logs-only");

  if (!logsOnly) {
    const { count } = await supabase.from("leads").select("id", { count: "exact", head: true });
    if (count && count > 0) {
      console.error(
        `leads table already has ${count} rows. This script does not de-duplicate — ` +
          `truncate leads/activity_log/activity_playbook first if you want to re-run, ` +
          `or pass --logs-only to just (re)import the log/playbook tables.`,
      );
      process.exit(1);
    }

    await migrateStandardSheet("BC_IGWF_Outreach", "bc-igwf-outreach");
    await migrateStandardSheet("BC_Other Team", "bc-other-team");
    await migrateStandardSheet("BC_Livelihood_Team", "bc-livelihood-team");
    await migrateStandardSheet("CB_Impact Practice", "cb-impact-practice");
    await migrateStandardSheet("BC_NE_Outreach", "bc-ne-outreach", {
      plannedActivityKey: "Outreach Activity",
      noOfInstitutionsKey: "No. of Institution",
    });
    await migrateStandardSheet("BC KA Outreach", "bc-ka-outreach", {
      plannedActivityKey: "Outreach Activity",
      noOfInstitutionsKey: "No. of Institution",
    });
    await migrateFutureTech();
    await migrateGovOutreach();
    await migratePcmTeam();
  }

  await migrateRtoCenters();
  await migrateDigitalOutreach();
  await migratePress();
  await migrateOutreachUpdates();
  await migratePlaybook();

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
