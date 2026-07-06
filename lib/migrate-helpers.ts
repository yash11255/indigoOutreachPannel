/** Pure parsing/normalization helpers used by scripts/migrate-excel.ts, split out for unit testing. */

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function isoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}

export const CANONICAL_STATUSES = [
  "Planned",
  "Contact Details Pending",
  "Contact Identified",
  "Outreach Request sent",
  "Approval Awaited",
  "Approved",
  "Rejected",
  "Activity Scheduled",
  "Activity Completed",
  "No Response",
  "Closed",
];

export function normalizeStatus(raw: unknown): { status: string; note: string | null } {
  const s = str(raw);
  if (!s) return { status: "Planned", note: null };
  const exact = CANONICAL_STATUSES.find((c) => c.toLowerCase() === s.toLowerCase());
  if (exact) return { status: exact, note: null };

  const lower = s.toLowerCase();
  const guess =
    (lower.includes("complet") && "Activity Completed") ||
    (lower.includes("reject") && "Rejected") ||
    (lower.includes("schedul") && "Activity Scheduled") ||
    (lower.includes("approv") && !lower.includes("await") && "Approved") ||
    (lower.includes("await") && "Approval Awaited") ||
    ((lower.includes("sent") || lower.includes("request")) && "Outreach Request sent") ||
    (lower.includes("no response") && "No Response") ||
    (lower.includes("closed") && "Closed") ||
    "Planned";

  return { status: guess, note: `Original status: ${s}` };
}

export function joinRemarks(...parts: (string | null)[]): string | null {
  const filtered = parts.filter((p): p is string => !!p && p.length > 0);
  return filtered.length ? filtered.join(" | ") : null;
}
