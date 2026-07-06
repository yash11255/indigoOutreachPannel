import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. NEVER import this into client components or expose
 * the key to the browser. Only used from server actions that have already
 * verified the caller is an admin.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
