"use client";

import { stageForStatus, type TimelineStep } from "@/lib/types";

const DOT_COLOR = {
  done: "bg-[#0f62fe] border-[#0f62fe]",
  pending: "bg-white border-[#c6c6c6]",
} as const;

const LINE_COLOR = {
  done: "bg-[#0f62fe]",
  upcoming: "bg-[#c6c6c6]",
} as const;

/**
 * Amazon-delivery-style progress tracker: a row of dots connected by a line,
 * one per round. Rounds don't have to finish in order — an institution can
 * have a future round already planned while an ad-hoc round in between gets
 * executed first — so each dot's done/pending state is its own
 * `executedDate`, not a single "current" cutoff along the sequence.
 */
export function LeadTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="overflow-x-auto py-2">
      <div className="flex min-w-max items-start">
        {steps.map((step, i) => {
          const isDone = !!step.executedDate;
          const prevDone = i === 0 || !!steps[i - 1].executedDate;
          const stage = stageForStatus(step.status);
          const isStalled = stage === "stalled";

          return (
            <div key={step.sequenceNo} className="flex items-start">
              <div className="flex w-36 flex-col items-center gap-2 px-1 text-center">
                <div className="flex w-full items-center">
                  <div
                    className={`h-0.5 flex-1 ${i === 0 ? "invisible" : prevDone ? LINE_COLOR.done : LINE_COLOR.upcoming}`}
                  />
                  <div
                    className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                      isStalled ? "border-[#da1e28] bg-[#da1e28]" : isDone ? DOT_COLOR.done : DOT_COLOR.pending
                    }`}
                  />
                  <div
                    className={`h-0.5 flex-1 ${i === steps.length - 1 ? "invisible" : isDone ? LINE_COLOR.done : LINE_COLOR.upcoming}`}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-800">{step.title}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    {step.executedDate ? (
                      <>Executed {step.executedDate}</>
                    ) : step.plannedDate ? (
                      <>Planned {step.plannedDate}</>
                    ) : (
                      "No date set"
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-neutral-600">
                    {step.status}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
