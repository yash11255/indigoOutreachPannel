/**
 * "team_admin" is a view-only role scoped to one outreach team (or, if
 * sub_team is also set on their profile, to just that client-account
 * sub-division within the team — e.g. the IBM lead under BC FutureTech).
 * They see every matching lead but can't create, edit, or execute anything,
 * and have no visibility outside their own scope.
 */
export type Role = "admin" | "member" | "team_admin";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "Member",
  team_admin: "Team Admin (view-only)",
};

/** team_admin is deliberately view-only — see migration 0016. */
export function canEditLeads(role: Role): boolean {
  return role !== "team_admin";
}

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  /** The outreach pipeline this person's leads are attributed to — drives every stat in the app. */
  team_id: string | null;
  /** Their CSR client-account/org team from the Employee Master Data — reference only, doesn't affect stats. */
  home_team: string | null;
  /** Only meaningful for a team_admin: narrows their view to one client-account sub-division within team_id, instead of the whole team. Null for every other role. */
  sub_team: string | null;
  /** This person's reporting manager, if set — that manager can see leads this person created, in addition to their own. */
  manager_id: string | null;
  /** A second, view-only manager — sees this person's leads same as manager_id, but can't edit them (unlike the primary manager). */
  secondary_manager_id: string | null;
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
  /** Client-account sub-division within the outreach team (e.g. IBM, Lenovo under BC FutureTech) — optional, set per-lead from the source sheet. */
  sub_team: string | null;
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
  /** Link to a Google Drive folder/file with session photos or other evidence. */
  drive_link: string | null;
  /** True for bulk-imported leads. Historically also granted team-wide read/write access regardless of attribution (migration 0015); reverted by migration 0019 — members now only ever see their own leads (or their reports'), so this no longer changes visibility for them. A team_admin's team-wide view (can_view_lead) is unaffected either way. */
  imported: boolean;
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
  no_of_institutions: number | null;
  planned_girls_reach: number | null;
  remarks: string | null;
  drive_link: string | null;
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

export function buildLeadTimeline(
  lead: Lead,
  rounds: LeadRound[],
): TimelineStep[] {
  const round1: TimelineStep = {
    sequenceNo: 1,
    title: lead.planned_activity || "Round 1",
    plannedDate: lead.planned_date,
    executedDate: lead.executed_date,
    // Round 1 lives directly on the `leads` row, sharing its `status` column
    // with the lead's own *overall* pipeline status — but those diverge once
    // a lead can stay "Planned" overall even after round 1 is individually
    // executed (no genuine session recorded yet anywhere). This step should
    // reflect what happened to round 1 itself: an executed_date means it was
    // genuinely carried out, full stop (a cancellation never sets
    // executed_date, so this can't collide with Rejected/No Response).
    status: lead.executed_date ? "Activity Completed" : lead.status,
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

/** Groups a flat list of lead_rounds by their parent lead_id, for O(1) lookup. */
export function groupRoundsByLead(rounds: LeadRound[]): Map<string, LeadRound[]> {
  const map = new Map<string, LeadRound[]>();
  for (const r of rounds) {
    const arr = map.get(r.lead_id) ?? [];
    arr.push(r);
    map.set(r.lead_id, arr);
  }
  return map;
}

/**
 * Reach numbers (planned or actual) can land on round 1 (the lead row
 * itself) or on any later round — the common case now is meeting/outreach
 * rounds first, with the real awareness session added as round 2, 3, etc.
 * Any dashboard/export that only reads the lead's own girls_reached /
 * no_of_institutions / planned_girls_reach column silently undercounts every
 * lead whose numbers were entered on a later round instead of round 1. These
 * helpers sum across both so metrics stay accurate regardless of which round
 * carried the real session.
 */
export function totalGirlsReached(
  lead: Pick<Lead, "id" | "girls_reached">,
  roundsByLead: Map<string, LeadRound[]>,
): number {
  const rounds = roundsByLead.get(lead.id) ?? [];
  return (lead.girls_reached ?? 0) + rounds.reduce((acc, r) => acc + (r.girls_reached ?? 0), 0);
}

export function totalStudentsReached(
  lead: Pick<Lead, "id" | "no_of_institutions">,
  roundsByLead: Map<string, LeadRound[]>,
): number {
  const rounds = roundsByLead.get(lead.id) ?? [];
  return (
    (lead.no_of_institutions ?? 0) +
    rounds.reduce((acc, r) => acc + (r.no_of_institutions ?? 0), 0)
  );
}

export function totalPlannedGirlsReach(
  lead: Pick<Lead, "id" | "planned_girls_reach">,
  roundsByLead: Map<string, LeadRound[]>,
): number {
  const rounds = roundsByLead.get(lead.id) ?? [];
  return (
    (lead.planned_girls_reach ?? 0) +
    rounds.reduce((acc, r) => acc + (r.planned_girls_reach ?? 0), 0)
  );
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
  "planned" | "outreach_sent" | "scheduled" | "completed" | "stalled";

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
  stalled: "Inactive",
};

export const STAGE_ORDER: LeadStage[] = [
  "planned",
  "outreach_sent",
  "scheduled",
  "completed",
  "stalled",
];

/** The two canonical statuses that mean "this activity isn't happening" — same vocabulary the Edit form's Status picker already offers. */
export const CANCEL_STATUSES = ["Rejected", "No Response"] as const;
export type CancelInput = {
  status: (typeof CANCEL_STATUSES)[number];
  remarks?: string;
};

export type MemberBreakdownRow = {
  member: string;
  teams: string;
  total: number;
  planned: number;
  inProgress: number;
  completed: number;
};

/**
 * Groups whatever leads the caller can already see (RLS decides that — this
 * just aggregates) by responsible_member. Used both on the full admin
 * dashboard (every lead) and on the regular Leads page for anyone seeing more
 * than just their own leads — a manager with direct reports, a team_admin, or
 * a regular member once teammates' imported leads become team-visible.
 */
export function buildMemberBreakdown(
  leads: Pick<Lead, "responsible_member" | "team_id" | "status">[],
  teams: Team[],
): MemberBreakdownRow[] {
  const memberMap = new Map<
    string,
    {
      total: number;
      planned: number;
      inProgress: number;
      completed: number;
      teamIds: Set<string>;
    }
  >();
  for (const l of leads) {
    const key = l.responsible_member?.trim() || "Unassigned";
    const entry = memberMap.get(key) ?? {
      total: 0,
      planned: 0,
      inProgress: 0,
      completed: 0,
      teamIds: new Set<string>(),
    };
    entry.total += 1;
    entry.teamIds.add(l.team_id);
    const stage = stageForStatus(l.status);
    if (stage === "planned") entry.planned += 1;
    else if (stage === "completed") entry.completed += 1;
    else if (stage === "outreach_sent" || stage === "scheduled")
      entry.inProgress += 1;
    memberMap.set(key, entry);
  }
  return Array.from(memberMap.entries())
    .map(([member, stats]) => ({
      member,
      total: stats.total,
      planned: stats.planned,
      inProgress: stats.inProgress,
      completed: stats.completed,
      teams: Array.from(stats.teamIds)
        .map((id) => teams.find((t) => t.id === id)?.name ?? "—")
        .join(", "),
    }))
    .sort((a, b) => b.total - a.total);
}

export type MemberInstitutionsGroup = {
  member: string;
  leads: Lead[];
};

/**
 * Same grouping key as buildMemberBreakdown (responsible_member), but keeps
 * each member's actual leads instead of just counts — for an expand-to-see
 * "which institutions is this person working" view.
 */
export function buildMemberInstitutions(leads: Lead[]): MemberInstitutionsGroup[] {
  const map = new Map<string, Lead[]>();
  for (const l of leads) {
    const key = l.responsible_member?.trim() || "Unassigned";
    const arr = map.get(key) ?? [];
    arr.push(l);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .map(([member, memberLeads]) => ({ member, leads: memberLeads }))
    .sort((a, b) => b.leads.length - a.leads.length);
}
