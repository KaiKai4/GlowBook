"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { deleteSalonCompletely } from "@/features/platform/data/platform.repo";
import { inviteSalon } from "@/features/platform/use-cases/invite-salon";
import { updateSalonFeatures } from "@/features/platform/use-cases/update-salon-features";
import type { Result } from "@/lib/result";

// Server Action wrapper: React form actions must return void.
// Error handling is done via revalidation and redirect in the use-case.
export async function inviteSalonAction(formData: FormData): Promise<void> {
  await inviteSalon(formData);
}

export async function deleteSalonAction(
  salonId: string,
  confirmation: string
): Promise<Result<void>> {
  await requirePlatformAdmin();

  if (confirmation !== salonId) {
    return {
      ok: false,
      error: "Para eliminar el salón debes escribir exactamente su ID.",
    };
  }

  try {
    await deleteSalonCompletely(salonId);
    revalidatePath("/admin");
    revalidatePath("/admin/salons");
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[platform]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: `No se pudo eliminar el salón y sus datos. Detalle: ${message}` };
  }
}

export async function updateSalonDisabledFeaturesAction(
  salonId: string,
  disabledFeatures: string[]
): Promise<Result<void>> {
  await requirePlatformAdmin();

  const result = await updateSalonFeatures({ salonId, disabledFeatures });
  if (!result.ok) return result;

  revalidatePath("/admin/salons");
  return { ok: true, value: undefined };
}
