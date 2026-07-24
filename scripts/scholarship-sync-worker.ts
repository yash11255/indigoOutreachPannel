/**
 * Standalone background worker for the Scholarship Portal (ScholarsBox)
 * integration — runs as its own PM2 process alongside the web app, not
 * in-process with Next.js (there's no clean "server startup" hook for a
 * long-lived interval inside `next start`).
 *
 * If SCHOLARSBOX_API_KEY isn't set, this exits immediately (code 0) rather
 * than looping forever doing nothing — the app behaves exactly as it does
 * today, live sync just doesn't run.
 *
 * PM2 setup (run once on the server):
 *   pm2 start "npx tsx scripts/scholarship-sync-worker.ts" --name scholarship-sync
 *   pm2 save
 */
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import { runScholarshipSync, isScholarshipSyncEnabled } from "../lib/scholarship/sync";

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

function log(message: string) {
  console.log(`[scholarship-sync ${new Date().toISOString()}] ${message}`);
}

async function syncOnce() {
  try {
    log("Starting sync…");
    const result = await runScholarshipSync();
    log(
      `Sync complete — registered: ${result.registered}, applied: ${result.applied}, draft: ${result.draft}, total: ${result.total}`,
    );
  } catch (err) {
    log(`Sync FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  if (!isScholarshipSyncEnabled()) {
    log("SCHOLARSBOX_API_KEY is not set — live sync is disabled, exiting.");
    process.exit(0);
  }

  log(`Worker starting — re-sync every ${SYNC_INTERVAL_MS / 60000} minutes.`);
  await syncOnce();

  setInterval(() => {
    void syncOnce();
  }, SYNC_INTERVAL_MS);
}

void main();
