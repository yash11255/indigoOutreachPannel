import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Current user's profile, or redirect to /login. Use in Server Components. */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) redirect("/login");
  return profile as Profile;
}

/** For admin-only pages. Non-admins are bounced to /leads. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/leads");
  return profile;
}

/** For pages a full admin can browse freely, or a team_admin can browse scoped to their own team. */
export async function requireAdminOrTeamAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "team_admin") redirect("/leads");
  return profile;
}

/** Same as requireProfile but throws instead of redirecting — for Server Actions. */
export async function requireProfileForAction(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) throw new Error("Unauthorized");
  return profile as Profile;
}

export async function requireAdminForAction(): Promise<Profile> {
  const profile = await requireProfileForAction();
  if (profile.role !== "admin") throw new Error("Forbidden: admin only");
  return profile;
}
