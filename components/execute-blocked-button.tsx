"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const DEFAULT_MESSAGE =
  "Nothing to execute here — every round on this lead is already resolved.";

/**
 * Stands in for the real "Mark as executed" quick button on a list view when
 * there's nothing currently pending to execute on that lead — stays visible
 * rather than disappearing, so the row doesn't look broken; clicking it
 * explains why instead of silently doing nothing.
 */
export function ExecuteBlockedButton({
  message = DEFAULT_MESSAGE,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={className}
      onClick={() => toast.error(message)}
    >
      Mark as executed
    </Button>
  );
}
