export type Role = "admin" | "member";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  team_id: string | null;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type Lead = {
  id: string;
  team_id: string;
  created_by: string | null;
  region: string | null;
  state: string | null;
  district_city: string | null;
  hobli: string | null;
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
  created_at: string;
  updated_at: string;
};

/** Round 2 onward for a lead with multiple touchpoints. Round 1 always lives on the Lead row itself. */
export type LeadRound = {
  id: string;
  lead_id: string;
  sequence_no: number;
  title: string | null;
  planned_date: string | null;
  executed_date: string | null;
  status: string;
  activity_undertaken: string | null;
  girls_reached: number | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** One step in a lead's Amazon-delivery-style progress timeline. */
export type TimelineStep = {
  sequenceNo: number;
  title: string;
  plannedDate: string | null;
  executedDate: string | null;
  status: string;
  activityUndertaken: string | null;
  girlsReached: number | null;
  /** The underlying round row's id, or null for round 1 (which lives on the lead itself). */
  roundId: string | null;
};

export function buildLeadTimeline(lead: Lead, rounds: LeadRound[]): TimelineStep[] {
  const round1: TimelineStep = {
    sequenceNo: 1,
    title: lead.planned_activity || "Round 1",
    plannedDate: lead.planned_date,
    executedDate: lead.executed_date,
    status: lead.status,
    activityUndertaken: lead.activity_undertaken,
    girlsReached: lead.girls_reached,
    roundId: null,
  };
  const rest: TimelineStep[] = rounds
    .slice()
    .sort((a, b) => a.sequence_no - b.sequence_no)
    .map((r) => ({
      sequenceNo: r.sequence_no,
      title: r.title || `Round ${r.sequence_no}`,
      plannedDate: r.planned_date,
      executedDate: r.executed_date,
      status: r.status,
      activityUndertaken: r.activity_undertaken,
      girlsReached: r.girls_reached,
      roundId: r.id,
    }));
  return [round1, ...rest];
}

export type StatusLookup = {
  code: string;
  meaning: string;
  sort_order: number;
};

export type RegionState = {
  id: string;
  region: string;
  state: string;
};

export type InstitutionType = {
  id: string;
  category: string;
  type: string;
};

/** NITI Aayog-sourced district reference (source: India_Geography_Master.xlsx). */
export type DistrictMaster = {
  id: string;
  region: string;
  state: string;
  district: string;
  district_code: string | null;
  division: string | null;
  is_aspirational: boolean;
  aspirational_programme: string | null;
  priority_category: string | null;
};

/** An interim outreach-update note logged against a lead (or one of its rounds) while it's still in progress. */
export type LeadUpdate = {
  id: string;
  lead_id: string;
  round_id: string | null;
  note: string;
  created_by: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  source: "digital" | "press" | "rto" | "outreach_updates";
  date: string | null;
  pillar: string | null;
  channel: string | null;
  mode: string | null;
  activity: string | null;
  region: string | null;
  state: string | null;
  district: string | null;
  reach: number | null;
  extra: Record<string, unknown>;
  created_at: string;
};

export type ActivityPlaybook = {
  id: string;
  institution_category: string;
  activity: string;
  description: string | null;
  channel_type: string | null;
  materials_needed: string | null;
  tips: string | null;
};

/** Derived UI stage — computed from `status`, never stored, so there's one source of truth. */
export type LeadStage =
  | "planned"
  | "outreach_sent"
  | "scheduled"
  | "completed"
  | "stalled";

const STAGE_BY_STATUS: Record<string, LeadStage> = {
  Planned: "planned",
  "Contact Details Pending": "planned",
  "Contact Identified": "planned",
  "Outreach Request sent": "outreach_sent",
  "Approval Awaited": "outreach_sent",
  Approved: "outreach_sent",
  "Activity Scheduled": "scheduled",
  "Activity Completed": "completed",
  Closed: "completed",
  "No Response": "stalled",
  Rejected: "stalled",
};

export function stageForStatus(status: string): LeadStage {
  return STAGE_BY_STATUS[status] ?? "planned";
}

export const STAGE_LABELS: Record<LeadStage, string> = {
  planned: "Planned",
  outreach_sent: "Outreach Sent",
  scheduled: "Scheduled",
  completed: "Completed",
  stalled: "Stalled",
};

export const STAGE_ORDER: LeadStage[] = [
  "planned",
  "outreach_sent",
  "scheduled",
  "completed",
  "stalled",
];
