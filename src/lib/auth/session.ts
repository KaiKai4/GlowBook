import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { ProfileWithRole } from "@/types/app.types";

export async function getProfile(): Promise<ProfileWithRole | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, salon_id, role_id, is_owner, full_name, is_active, salon:salons(disabled_features), role:roles(id, name, role_permissions(permission:permissions(id, key, description)))")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  return data as unknown as ProfileWithRole;
}

export async function requireProfile(): Promise<ProfileWithRole> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireActiveProfile(): Promise<ProfileWithRole> {
  const profile = await requireProfile();

  if (!profile.is_active) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id, is_active")
    .eq("id", profile.salon_id)
    .maybeSingle();

  if (!salon) redirect("/login");
  if (!salon.is_active) redirect("/");

  return profile;
}

export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data !== null;
}

export async function requirePlatformAdmin(): Promise<void> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) redirect("/login");
}
