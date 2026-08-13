"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Root error boundary — wraps every page below app/layout.tsx. Two known
 * causes handled here:
 *
 * 1. "Failed to find Server Action" — the client still has a page open
 *    from before the last deploy, and its Server Action IDs no longer
 *    exist on the newly-deployed server. Not a real bug, just a stale
 *    tab; a reload always fixes it. Was previously an unhandled crash
 *    (see PM2 error log) that just left members staring at a broken page.
 * 2. Anything else — a generic apology + reload/retry, instead of
 *    Next.js's default unstyled crash screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleDeploy = /Failed to find Server Action/i.test(error.message);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>
            {isStaleDeploy ? "This page is out of date" : "Something went wrong"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-neutral-500">
            {isStaleDeploy
              ? "The app was updated since you opened this page. Refresh to pick up the latest version — nothing you'd entered was lost on our end."
              : "An unexpected error occurred. Try again, and if it keeps happening, let the admin team know."}
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-neutral-400">Reference: {error.digest}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Refresh page</Button>
            {!isStaleDeploy && (
              <Button variant="outline" onClick={reset}>
                Try again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
