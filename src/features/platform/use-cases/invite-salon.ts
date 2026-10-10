import {
  createSalonInvitation,
  regenerateSalonInvitationToken,
} from "@/features/platform/data/invitations.repo";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import { z } from "@/infra/validation/zod";
import { publishAuditEvent } from "@/features/audit";
import { firstIssueMessage } from "@/infra/validation/first-issue";

// El plan es obligatorio: el salón debe nacer con su plan asignado para que
// el owner nunca vea funcionalidades fuera de lo contratado.
const InviteSchema = z.object({
  email: z.string().email("Email inválido"),
  planId: z.string().uuid("Selecciona el plan que tendrá el salón."),
});

export interface InviteSalonInput extends z.input<typeof InviteSchema> {
  actorUserId?: string | null;
  /** Resuelto por el llamador desde la sesion (requirePlatformAdmin). */
  actorIsPlatformAdmin: boolean;
}

export async function inviteSalon(input: InviteSalonInput): Promise<Result<string>> {
  if (!input.actorIsPlatformAdmin) return err("No autorizado.");

  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));

  const emailDomain = parsed.data.email.split("@").at(-1) ?? "unknown";

  try {
    const token = await createSalonInvitation(parsed.data.email, parsed.data.planId);
    const warnings = await publishAuditEvent("platform.salon_invited", {
      actorUserId: input.actorUserId ?? null,
      action: "invite_salon",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain, planId: parsed.data.planId },
    });
    return ok(token, warnings);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "invite_salon",
      metadata: { emailDomain },
    });
    await publishAuditEvent("platform.salon_invited", {
      actorUserId: input.actorUserId ?? null,
      action: "invite_salon",
      status: "failed",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain, planId: parsed.data.planId },
      errorMessage: error instanceof Error ? error.message : "Error desconocido",
    });
    return err("Error al crear la invitación.");
  }
}

/**
 * Reemplaza el token de una invitación pendiente. El enlace anterior queda
 * invalidado y el nuevo se muestra una sola vez.
 */
export async function regenerateSalonInvitation(input: {
  invitationId: string;
  actorUserId?: string | null;
  actorIsPlatformAdmin: boolean;
}): Promise<Result<string>> {
  if (!input.actorIsPlatformAdmin) return err("No autorizado.");

  try {
    const token = await regenerateSalonInvitationToken(input.invitationId);
    const warnings = await publishAuditEvent("platform.salon_invitation_regenerated", {
      actorUserId: input.actorUserId ?? null,
      action: "regenerate_salon_invitation",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      targetResourceId: input.invitationId,
    });
    return ok(token, warnings);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "regenerate_salon_invitation",
      metadata: { invitationId: input.invitationId },
    });
    await publishAuditEvent("platform.salon_invitation_regenerated", {
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
