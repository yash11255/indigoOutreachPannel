"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ScholarshipSyncRun } from "@/lib/data/scholarship";

function formatTimestamp(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Manual sync trigger for the Scholarship Portal integration, mirroring
 * this app's usual "action button + toast result" pattern. Disabled with an
 * explanation when SCHOLARSBOX_API_KEY isn't configured, rather than hidden
 * outright, so it's clear this feature exists but needs setup. */
export function ScholarshipSyncButton({
  syncEnabled,
  latestRun,
}: {
  syncEnabled: boolean;
  latestRun: ScholarshipSyncRun | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(
    latestRun && latestRun.status === "success"
      ? `Last synced ${formatTimestamp(latestRun.finished_at)} — Registered N/A, Draft ${latestRun.draft_count ?? 0}, Applied ${latestRun.applied_count ?? 0}`
      : null,
  );

  function sync() {
    startTransition(async () => {
      try {
        const res = await fetch("/admin/scholarship/sync", { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Sync failed");
        setLastResult(
          `Synced just now — Registered ${json.registered}, Draft ${json.draft}, Applied ${json.applied} (total ${json.total})`,
        );
        toast.success("Scholarship data synced");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sync failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={sync} disabled={!syncEnabled || pending} variant="outline">
        {pending ? "Syncing…" : "Sync now"}
      </Button>
      {!syncEnabled ? (
        <p className="max-w-xs text-right text-xs text-neutral-400">
          SCHOLARSBOX_API_KEY isn&apos;t set — sync is disabled.
        </p>
      ) : (
        <p className="max-w-xs text-right text-xs text-neutral-400">
          {lastResult ?? `Last synced ${formatTimestamp(latestRun?.finished_at ?? null)}`}
        </p>
      )}
    </div>
  );
}
