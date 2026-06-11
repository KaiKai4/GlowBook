"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { deleteSalon } from "@/features/platform/use-cases/delete-salon";
import { inviteSalon } from "@/features/platform/use-cases/invite-salon";
import { updateSalonStatus } from "@/features/platform/use-cases/update-salon-status";
import type { Result } from "@/lib/result";

export async function inviteSalonAction(formData: FormData): Promise<void> {
  const actorUserId = await requirePlatformAdmin();
  const result = await inviteSalon({
    email: String(formData.get("email") ?? ""),
    planId: String(formData.get("planId") ?? ""),
    actorUserId,
  });
  if (!result.ok) throw new Error(result.error);
  revalidatePath("/admin");
  revalidatePath("/admin/invitations");
}

export async function deleteSalonAction(
  salonId: string,
  confirmation: string
): Promise<Result<void>> {
  const actorUserId = await requirePlatformAdmin();

  const result = await deleteSalon({ salonId, confirmation, actorUserId });
  if (!result.ok) return result;

  revalidatePath("/admin");
  revalidatePath("/admin/salons");
  return { ok: true, value: undefined };
}

export async function updateSalonStatusAction(
  salonId: string,
  isActive: boolean
): Promise<Result<void>> {
  const actorUserId = await requirePlatformAdmin();

  const result = await updateSalonStatus({ salonId, isActive, actorUserId });
  if (!result.ok) return result;

  revalidatePath("/admin");
  revalidatePath("/admin/salons");
  revalidatePath("/admin/audit");
  return { ok: true, value: undefined };
}
