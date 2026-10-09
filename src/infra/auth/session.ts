import { createSupabaseServerClient } from "@/infra/supabase/server";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { ProfileWithRole } from "@/types/app.types";
import { getEffectiveDisabledSalonFeatures } from "@/features/billing/use-cases/commercial-plans";

export const getProfile = cache(async (): Promise<ProfileWithRole | null> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, salon_id, role_id, is_owner, full_name, is_active, salon:salons(disabled_features), role:roles(id, name, role_permissions(permission:permissions(id, key, description)))")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  const profile = data as unknown as ProfileWithRole;

  // El perfil sale con los modulos efectivos del plan comercial (con fallback
  // a salons.disabled_features si no hay plan): hasPermission y la navegacion
  // deben decidir con la misma fuente, no con la columna legacy a secas.
  const disabledFeatures = await getEffectiveDisabledSalonFeatures(profile);
  return { ...profile, salon: { disabled_features: disabledFeatures } };
});

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

export async function requirePlatformAdmin(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) redirect("/login");
  return user.id;
}
