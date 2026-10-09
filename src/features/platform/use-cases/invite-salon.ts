import {
  createSalonInvitation,
  regenerateSalonInvitationToken,
} from "@/features/platform/data/invitations.repo";
import { err, ok, type Result } from "@/lib/result";
import { isPlatformAdmin } from "@/lib/auth/session";
import { captureError } from "@/lib/observability";
import { z } from "@/lib/validation/zod";
import { recordPlatformAction } from "./platform-audit";
import { firstIssueMessage } from "@/lib/validation/first-issue";

// El plan es obligatorio: el salon debe nacer con su plan asignado para que
// el owner nunca vea funcionalidades fuera de lo contratado.
const InviteSchema = z.object({
  email: z.string().email("Email inválido"),
  planId: z.string().uuid("Selecciona el plan que tendra el salon."),
});

export interface InviteSalonInput extends z.input<typeof InviteSchema> {
  actorUserId?: string | null;
}

export async function inviteSalon(input: InviteSalonInput): Promise<Result<string>> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) return err("No autorizado.");

  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));

  const emailDomain = parsed.data.email.split("@").at(-1) ?? "unknown";

  try {
    const token = await createSalonInvitation(parsed.data.email, parsed.data.planId);
    await recordPlatformAction({
      actorUserId: input.actorUserId ?? null,
      action: "invite_salon",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain, planId: parsed.data.planId },
    });
    return ok(token);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "invite_salon",
      metadata: { emailDomain },
    });
    await recordPlatformAction({
      actorUserId: input.actorUserId ?? null,
      action: "invite_salon",
      status: "failed",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain, planId: parsed.data.planId },
      errorMessage: error instanceof Error ? error.message : "Error desconocido",
    });
    return err("Error al crear la invitacion.");
  }
}

/**
 * Reemplaza el token de una invitacion pendiente. El enlace anterior queda
 * invalidado y el nuevo se muestra una sola vez.
 */
export async function regenerateSalonInvitation(input: {
  invitationId: string;
  actorUserId?: string | null;
}): Promise<Result<string>> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) return err("No autorizado.");

  try {
    const token = await regenerateSalonInvitationToken(input.invitationId);
    await recordPlatformAction({
      actorUserId: input.actorUserId ?? null,
      action: "regenerate_salon_invitation",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      targetResourceId: input.invitationId,
    });
    return ok(token);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "regenerate_salon_invitation",
      metadata: { invitationId: input.invitationId },
    });
    await recordPlatformAction({
      actorUserId: input.actorUserId ?? null,
      action: "regenerate_salon_invitation",
      status: "failed",
      targetResourceType: "salon_invitation",
      targetResourceId: input.invitationId,
      errorMessage: error instanceof Error ? error.message : "Error desconocido",
    });
    return err("No se pudo regenerar el enlace.");
  }
}
