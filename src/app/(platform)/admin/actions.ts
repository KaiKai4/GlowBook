"use server";

import { definePlatformAction } from "@/app/_composition/define-platform-action";
import { parseUuidField } from "@/app/_composition/define-action";
import { ok, type Result } from "@/infra/result";
import { formText } from "@/infra/validation/form-fields";
import { deleteSalon } from "@/features/platform";
import {
  inviteSalon,
  regenerateSalonInvitation,
} from "@/features/platform";
import { updateSalonStatus } from "@/features/platform";

// Devuelve el token en claro: el enlace solo puede mostrarse en esta
// respuesta porque la DB guarda unicamente el hash.
const inviteSalonFlow = definePlatformAction<FormData, { email: string; planId: string }, string>({
  rateLimit: { scope: "admin:inviteSalonAction" },
  parse: (formData) =>
    ok({ email: formText(formData.get("email")), planId: formText(formData.get("planId")) }),
  run: (input, session) =>
    inviteSalon({ ...input, actorUserId: session.userId, actorIsPlatformAdmin: true }),
  revalidate: () => ["/admin", "/admin/invitations"],
});

export async function inviteSalonAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return inviteSalonFlow(formData);
}

const regenerateInvitationFlow = definePlatformAction<string, string, string>({
  rateLimit: { scope: "admin:regenerateSalonInvitationAction" },
  parse: parseUuidField,
  run: (invitationId, session) =>
    regenerateSalonInvitation({ invitationId, actorUserId: session.userId, actorIsPlatformAdmin: true }),
  revalidate: () => ["/admin/invitations"],
});

export async function regenerateSalonInvitationAction(
  invitationId: string
): Promise<Result<string>> {
  return regenerateInvitationFlow(invitationId);
}

interface SalonIdentity {
  salonId: string;
}

const deleteSalonFlow = definePlatformAction<
  SalonIdentity & { confirmation: string },
  SalonIdentity & { confirmation: string },
  void
>({
  rateLimit: { scope: "admin:deleteSalonAction" },
  parse: (raw) => {
    const salonId = parseUuidField(raw.salonId);
    return salonId.ok ? ok(raw) : salonId;
  },
  run: async ({ salonId, confirmation }, session) => {
    const result = await deleteSalon({ salonId, confirmation, actorUserId: session.userId });
    return result.ok ? ok(undefined) : result;
  },
  revalidate: () => ["/admin", "/admin/salons"],
});

export async function deleteSalonAction(
  salonId: string,
  confirmation: string
): Promise<Result<void>> {
  return deleteSalonFlow({ salonId, confirmation });
}

const updateSalonStatusFlow = definePlatformAction<
  SalonIdentity & { isActive: boolean },
  SalonIdentity & { isActive: boolean },
  void
>({
  rateLimit: { scope: "admin:updateSalonStatusAction" },
  parse: (raw) => {
    const salonId = parseUuidField(raw.salonId);
    return salonId.ok ? ok(raw) : salonId;
  },
  run: async ({ salonId, isActive }, session) => {
    const result = await updateSalonStatus({ salonId, isActive, actorUserId: session.userId });
    return result.ok ? ok(undefined) : result;
  },
  revalidate: () => ["/admin", "/admin/salons", "/admin/audit"],
});

export async function updateSalonStatusAction(
  salonId: string,
  isActive: boolean
): Promise<Result<void>> {
  return updateSalonStatusFlow({ salonId, isActive });
}
