"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminForAction } from "@/lib/data/session";

export type CreateMemberState = {
  error?: string;
  success?: boolean;
  tempPassword?: string;
};

function randomPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/** Standard default for every new member login — admins get a random one instead. */
const DEFAULT_MEMBER_PASSWORD = "indigo@123";

/**
 * Admin creates a teammate's login directly (no self-signup, per team-scoped
 * roles). Members get the org-wide default password (indigo@123) so admins
 * don't have to distribute a unique one per person; admin accounts get a
 * random password instead since there's no shared default for that role.
 * Either way, the password is shown once here so it can be shared out-of-band.
 */
export async function createMember(
  _prevState: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  await requireAdminForAction();

  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const teamId = String(formData.get("team_id") ?? "").trim();
  const role = String(formData.get("role") ?? "member").trim();

  if (!email) return { error: "Email is required." };
  if ((role === "member" || role === "team_admin") && !teamId)
    return { error: "Team is required for this role." };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "This form needs SUPABASE_SERVICE_ROLE_KEY configured, which isn't set up yet. " +
        "Ask whoever is managing the database to create this login directly instead.",
    };
  }

  const admin = createAdminClient();
  const password =
    role === "admin" ? randomPassword() : DEFAULT_MEMBER_PASSWORD;

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
  if (createError || !created.user) {
    return { error: createError?.message ?? "Failed to create user." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName || null,
      team_id: role === "admin" ? null : teamId,
      role,
    })
    .eq("id", created.user.id);

  if (profileError) return { error: profileError.message };

  revalidatePath("/admin/users");
  return { success: true, tempPassword: password };
}

export type CreateTeamState = { error?: string; success?: boolean };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createTeam(
  _prevState: CreateTeamState,
  formData: FormData,
): Promise<CreateTeamState> {
  await requireAdminForAction();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Team name is required." };

  const slug = slugify(name);
  if (!slug)
    return { error: "Team name must contain at least one letter or number." };

  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({ name, slug });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A team with that name (or the same slug) already exists.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/leads");
  return { success: true };
}

export async function updateTeam(formData: FormData) {
  await requireAdminForAction();

  const teamId = String(formData.get("team_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!teamId) throw new Error("Missing team id");
  if (!name) throw new Error("Team name is required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ name })
    .eq("id", teamId);

  if (error) {
    if (error.code === "23505")
      throw new Error("A team with that name already exists.");
    throw new Error(error.message);
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/leads");
}

export async function updateMember(formData: FormData) {
  await requireAdminForAction();

  const userId = String(formData.get("user_id") ?? "");
  const teamId = String(formData.get("team_id") ?? "").trim();
  const role = String(formData.get("role") ?? "member").trim();
  const managerId = String(formData.get("manager_id") ?? "").trim();
  if (!userId) throw new Error("Missing user id");
  if (managerId === userId)
    throw new Error("A person can't be their own manager.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      role,
      team_id: role === "admin" ? null : teamId || null,
      manager_id: managerId || null,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
