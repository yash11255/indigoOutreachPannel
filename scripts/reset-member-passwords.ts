/**
 * One-off: resets every non-admin profile's login password to the org-wide
 * default (indigo@123), leaving admin accounts untouched. Meant to bring the
 * ~106 bulk-generated member accounts in line with the new default so admins
 * don't have to hand out individually-generated passwords from the old CSV.
 *
 * Usage:
 *   npx tsx scripts/reset-member-passwords.ts
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_MEMBER_PASSWORD = "indigo@123";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function main() {
  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: members, error } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "member");

  if (error) {
    console.error("Failed to list member profiles:", error.message);
    process.exit(1);
  }

  console.log(`Resetting ${members.length} member accounts to the default password…`);

  let ok = 0;
  let failed = 0;
  for (const m of members) {
    const { error: updateError } = await admin.auth.admin.updateUserById(m.id, {
      password: DEFAULT_MEMBER_PASSWORD,
    });
    if (updateError) {
      failed++;
      console.error(`  FAILED ${m.email} (${m.full_name ?? "no name"}): ${updateError.message}`);
    } else {
      ok++;
    }
  }

  console.log(`Done. ${ok} reset, ${failed} failed.`);
}

main();
