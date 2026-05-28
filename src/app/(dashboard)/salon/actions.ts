"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SalonInfoSchema, BusinessHoursSchema, SALON_THEMES, type SalonTheme, SALON_BG_STYLES, type SalonBgStyle } from "@/features/salon/schemas";
import type { Result } from "@/lib/result";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.SALON_MANAGE)) {
    return { ok: false, error: "No tienes permiso para editar el salón." };
  }
  return { ok: true, value: { salonId: profile.salon_id } };
}

export async function updateSalonInfoAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  const parsed = SalonInfoSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salons")
    .update({ name: parsed.data.name })
    .eq("id", g.value.salonId);
  if (error) return { ok: false, error: "Error al guardar el nombre del salón." };

  // Refresh the dashboard layout so the sidebar brand updates everywhere.
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

export async function updateSalonThemeAction(theme: string): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  if (!SALON_THEMES.includes(theme as SalonTheme)) {
    return { ok: false, error: "Tema inválido." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salons")
    .update({ theme })
    .eq("id", g.value.salonId);
  if (error) return { ok: false, error: "Error al guardar la gama de colores." };

  // The accent palette lives in the dashboard layout, so refresh it everywhere.
  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

export async function updateSalonBgAction(bgStyle: string): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  if (!SALON_BG_STYLES.includes(bgStyle as SalonBgStyle)) {
    return { ok: false, error: "Estilo de fondo inválido." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salons")
    .update({ bg_style: bgStyle })
    .eq("id", g.value.salonId);
  if (error) return { ok: false, error: "Error al guardar el fondo." };

  revalidatePath("/", "layout");
  return { ok: true, value: undefined };
}

export async function updateBusinessHoursAction(
  hoursJson: string
): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  let raw: unknown;
  try {
    raw = JSON.parse(hoursJson);
  } catch (err) {
    console.error("[salon] invalid hours JSON", err);
    return { ok: false, error: "Datos de horario inválidos." };
  }

  const parsed = BusinessHoursSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const rows = parsed.data.map((d) => ({
    salon_id: g.value.salonId,
    day_of_week: d.day_of_week,
    is_open: d.is_open,
    open_time: d.is_open ? d.open_time : null,
    close_time: d.is_open ? d.close_time : null,
  }));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salon_business_hours")
    .upsert(rows, { onConflict: "salon_id,day_of_week" });
  if (error) return { ok: false, error: "Error al guardar los horarios." };

  // Booking availability reads these hours, so refresh the agenda + wizard.
  revalidatePath("/salon");
  revalidatePath("/appointments");
  revalidatePath("/appointments/new");
  return { ok: true, value: undefined };
}
