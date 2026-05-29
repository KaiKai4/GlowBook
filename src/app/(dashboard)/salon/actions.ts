"use server";

import { revalidatePath } from "next/cache";
import { updateBusinessHours } from "@/features/salon/use-cases/update-business-hours";
import { updateSalonBackground } from "@/features/salon/use-cases/update-salon-background";
import { updateSalonInfo } from "@/features/salon/use-cases/update-salon-info";
import { updateSalonTheme } from "@/features/salon/use-cases/update-salon-theme";
import { BusinessHoursSchema, SalonInfoSchema } from "@/features/salon/schemas";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import type { Result } from "@/lib/result";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.SALON_MANAGE)) {
    return { ok: false, error: "No tienes permiso para editar el salon." };
  }

  return { ok: true, value: { salonId: profile.salon_id } };
}

export async function updateSalonInfoAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const parsed = SalonInfoSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await updateSalonInfo(guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateSalonThemeAction(theme: string): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const result = await updateSalonTheme(guarded.value.salonId, theme);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateSalonBgAction(bgStyle: string): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const result = await updateSalonBackground(guarded.value.salonId, bgStyle);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateBusinessHoursAction(hoursJson: string): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  let raw: unknown;
  try {
    raw = JSON.parse(hoursJson);
  } catch {
    return { ok: false, error: "Datos de horario invalidos." };
  }

  const parsed = BusinessHoursSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await updateBusinessHours(guarded.value.salonId, parsed.data);
  if (result.ok) {
    revalidatePath("/salon");
    revalidatePath("/appointments");
    revalidatePath("/appointments/new");
  }

  return result;
}
