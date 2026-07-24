import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { Lead } from "@/lib/types";

function daysOverdue(plannedDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const planned = new Date(plannedDate);
  return Math.round((today.getTime() - planned.getTime()) / 86_400_000);
}

/**
 * Banner of leads whose planned date has arrived but haven't been executed
 * yet. `outreachOnlyIds` marks which of these have only ever had outreach —
 * a WhatsApp message, an email — never a genuine session: those get a
 * pointed reminder to actually resolve the lead (execute it, or mark it
 * Rejected/No Response) rather than the generic "days overdue" note, and
 * sort to the top since they're the ones most likely to just be forgotten.
 */
export function DueBanner({
  leads,
  outreachOnlyIds = new Set(),
}: {
  leads: Lead[];
  outreachOnlyIds?: Set<string>;
}) {
  if (leads.length === 0) return null;

  const overdue = leads.filter((l) => daysOverdue(l.planned_date!) > 0);
  const sorted = leads
    .slice()
    .sort((a, b) => Number(outreachOnlyIds.has(b.id)) - Number(outreachOnlyIds.has(a.id)));

  return (
    <Card className="border-[#f1c21b] bg-[#fcf4d6]">
      <CardContent className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[#8a5300]">
          {leads.length} lead{leads.length === 1 ? "" : "s"} due for execution
          {overdue.length > 0 ? ` (${overdue.length} overdue)` : ""}
        </h2>
        <div className="flex flex-col gap-1">
          {sorted.slice(0, 6).map((lead) => {
            const overdueBy = daysOverdue(lead.planned_date!);
            const needsStatusUpdate = overdueBy > 0 && outreachOnlyIds.has(lead.id);
            return (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between gap-3 text-sm text-[#161616] hover:underline"
              >
                <span>{lead.institution_name}</span>
                <span className="shrink-0 text-right text-xs text-[#8a5300]">
                  {needsStatusUpdate
                    ? `Only outreach sent, no update — executed, rejected, or no response?`
                    : overdueBy > 0
                      ? `${overdueBy} day${overdueBy === 1 ? "" : "s"} overdue`
                      : "due today"}
                </span>
              </Link>
            );
          })}
          {leads.length > 6 && (
            <div className="text-xs text-[#8a5300]">+{leads.length - 6} more</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
