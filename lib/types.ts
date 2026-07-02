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
