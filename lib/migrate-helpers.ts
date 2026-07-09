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

const MS_PER_DAY = 86_400_000;

export function isoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    // Excel/Sheets date serials exported from Google Sheets sometimes carry
    // tiny floating-point drift (e.g. 23:59:50 instead of exact midnight),
    // which pushes a plain toISOString() truncation back a day. Round to the
    // nearest day first to recover the intended calendar date.
    const rounded = new Date(Math.round(v.getTime() / MS_PER_DAY) * MS_PER_DAY);
    return rounded.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    // A cell Excel didn't recognize as a date comes through as free text
    // instead of a Date object — day-first, matching how these sheets are
    // actually filled in (e.g. "30/6/2026", "5/07/2026").
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }
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
