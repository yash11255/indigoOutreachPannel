import { NextResponse } from "next/server";
import { requireAdminForAction } from "@/lib/data/session";
import { runScholarshipSync, isScholarshipSyncEnabled } from "@/lib/scholarship/sync";

/** Manual "Sync Now" trigger for the Scholarship Portal integration —
 * admin-only, same auth as every other data-mutating route in this app. */
export async function POST() {
  try {
    await requireAdminForAction();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isScholarshipSyncEnabled()) {
    return NextResponse.json(
      { error: "SCHOLARSBOX_API_KEY is not configured — live sync is disabled." },
      { status: 400 },
    );
  }

  try {
    const result = await runScholarshipSync();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}
