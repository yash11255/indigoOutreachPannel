import { Badge } from "@/components/ui/badge";
import { stageForStatus, STAGE_LABELS, type LeadStage } from "@/lib/types";

const STAGE_COLORS: Record<LeadStage, string> = {
  planned: "bg-[#e0e0e0] text-[#161616] border-[#c6c6c6]",
  outreach_sent: "bg-[#edf5ff] text-[#0043ce] border-[#a6c8ff]",
  scheduled: "bg-[#fcf4d6] text-[#8a5300] border-[#f1c21b]",
  completed: "bg-[#defbe6] text-[#0e6027] border-[#a7f0ba]",
  stalled: "bg-[#fff1f1] text-[#a2191f] border-[#ffd7d9]",
};

export function StageBadge({ status }: { status: string }) {
  const stage = stageForStatus(status);
  return (
    <Badge variant="outline" className={`${STAGE_COLORS[stage]} rounded-none`}>
      {STAGE_LABELS[stage]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className="rounded-none">
      {status}
    </Badge>
  );
}
