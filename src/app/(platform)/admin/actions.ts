"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/infra/auth/session";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { parseUuid } from "@/infra/validation/route-id";
import { deleteSalon } from "@/features/platform/use-cases/delete-salon";
import {
  inviteSalon,
  regenerateSalonInvitation,
} from "@/features/platform/use-cases/invite-salon";
import { updateSalonStatus } from "@/features/platform/use-cases/update-salon-status";
import type { Result } from "@/infra/result";

// Devuelve el token en claro: el enlace solo puede mostrarse en esta
// respuesta porque la DB guarda unicamente el hash.
export async function inviteSalonAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:inviteSalonAction");
  if (!limited.ok) return limited;
  const result = await inviteSalon({
    email: String(formData.get("email") ?? ""),
    planId: String(formData.get("planId") ?? ""),
    actorUserId,
  });
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/invitations");
  }
  return result;
}

export async function regenerateSalonInvitationAction(
  invitationId: string
): Promise<Result<string>> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:regenerateSalonInvitationAction");
  if (!limited.ok) return limited;
  if (!parseUuid(invitationId)) return { ok: false, error: "Identificador inválido." };
  const result = await regenerateSalonInvitation({ invitationId, actorUserId });
  if (result.ok) revalidatePath("/admin/invitations");
  return result;
}

export async function deleteSalonAction(
  salonId: string,
  confirmation: string
): Promise<Result<void>> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:deleteSalonAction");
  if (!limited.ok) return limited;
  if (!parseUuid(salonId)) return { ok: false, error: "Identificador inválido." };

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
  const limited = await assertActionRateLimit(actorUserId, "admin:updateSalonStatusAction");
  if (!limited.ok) return limited;
  if (!parseUuid(salonId)) return { ok: false, error: "Identificador inválido." };

  const result = await updateSalonStatus({ salonId, isActive, actorUserId });
  if (!result.ok) return result;

  revalidatePath("/admin");
  revalidatePath("/admin/salons");
  revalidatePath("/admin/audit");
  return { ok: true, value: undefined };
}
