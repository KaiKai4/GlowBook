import { createSalonInvitation } from "@/features/platform/data/invitations.repo";
import { err, ok, type Result } from "@/lib/result";
import { isPlatformAdmin } from "@/lib/auth/session";
import { captureError } from "@/lib/observability";
import { z } from "zod";
import { recordPlatformAction } from "./platform-audit";

// El plan es obligatorio: el salon debe nacer con su plan asignado para que
// el owner nunca vea funcionalidades fuera de lo contratado.
const InviteSchema = z.object({
  email: z.string().email("Email invalido"),
  planId: z.string().uuid("Selecciona el plan que tendra el salon."),
});

export interface InviteSalonInput extends z.input<typeof InviteSchema> {
  actorUserId?: string | null;
}

export async function inviteSalon(input: InviteSalonInput): Promise<Result<string>> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) return err("No autorizado.");

  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);

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
