"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { deleteSalon } from "@/features/platform/use-cases/delete-salon";
import { inviteSalon } from "@/features/platform/use-cases/invite-salon";
import { updateSalonFeatures } from "@/features/platform/use-cases/update-salon-features";
import type { Result } from "@/lib/result";

export async function inviteSalonAction(formData: FormData): Promise<void> {
  await inviteSalon({ email: String(formData.get("email") ?? "") });
  revalidatePath("/admin");
}

export async function deleteSalonAction(
  salonId: string,
  confirmation: string
): Promise<Result<void>> {
  await requirePlatformAdmin();

  const result = await deleteSalon({ salonId, confirmation });
  if (!result.ok) return result;

  revalidatePath("/admin");
  revalidatePath("/admin/salons");
  return { ok: true, value: undefined };
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
