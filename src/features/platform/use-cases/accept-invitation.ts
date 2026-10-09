import {
  acceptSalonInvitationAsAdmin,
  findSalonInvitationForAcceptance,
  profileExists,
} from "@/features/platform/data/invitations.repo";
import { err, ok, type Result } from "@/infra/result";
import {
  createPlatformOwnerAuthUser,
  deletePlatformOwnerAuthUser,
  findPlatformOwnerAuthUserByEmail,
  updatePlatformOwnerAuthUser,
} from "@/features/platform/data/platform-auth.repo";
import { captureError } from "@/infra/observability";
import { personNameField } from "@/infra/validation/name";
import { autoAssignPlanOnAcceptance } from "@/features/billing";
import { publishAuditEvent } from "@/features/audit";
import { z } from "@/infra/validation/zod";
import { firstIssueMessage } from "@/infra/validation/first-issue";

const AcceptSchema = z.object({
  token: z.string().min(1, "Token inválido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
  salon_name: z.string().min(1, "El nombre del salon es obligatorio").max(120),
  full_name: personNameField("Tu nombre es obligatorio", "Tu nombre"),
});

export type AcceptInvitationInput = z.infer<typeof AcceptSchema>;

// Translates raw Postgres / RPC errors into messages a non-technical user can act on.
function translateAcceptError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("profiles_pkey") || m.includes("duplicate key")) {
    return (
      "Este correo ya pertenece a una cuenta de otro salon en GlowBook. " +
      "Cada cuenta puede pertenecer a un solo salon: usa un correo distinto para crear el nuevo salon."
    );
  }
  // The RPC already raises user-facing Spanish messages (token inválido/expirado).
  if (m.includes("invitaci")) return message;
  return "No se pudo crear el salon. Intentalo de nuevo o solicita una nueva invitacion.";
}

async function rollbackCreatedOwner(userId: string): Promise<void> {
  const { error } = await deletePlatformOwnerAuthUser(userId);
  if (error && error.status !== 404) {
    captureError(error, {
      module: "platform",
      action: "accept_invitation_rollback",
      metadata: { userId },
    });
  }
}

// Server-side acceptance: creates the owner account (email pre-confirmed) and the
// salon atomically using the privileged data adapter. No dependency on email confirmation.
export async function acceptInvitation(input: AcceptInvitationInput): Promise<Result<void>> {
  const parsed = AcceptSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));

  const { token, email, password, salon_name, full_name } = parsed.data;
  const emailDomain = email.split("@").at(-1) ?? "unknown";

  let invitation;
  try {
    invitation = await findSalonInvitationForAcceptance(token);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "accept_invitation_lookup",
      metadata: { emailDomain },
    });
    return err("No se pudo verificar la invitacion.");
  }

  if (!invitation || invitation.status !== "pending") {
    return err("Invitacion inválida o ya utilizada.");
  }
  if (new Date(invitation.expires_at) < new Date()) return err("La invitacion expiro.");
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    return err("Esta invitacion fue emitida para otro correo.");
  }

  let userId: string;
  let createdNewUser = false;
  const { data: created, error: createError } = await createPlatformOwnerAuthUser({
    email,
    password,
    emailConfirm: true,
  });

  if (createError || !created) {
    if (!createError?.message?.toLowerCase().includes("already")) {
      return err("No se pudo crear la cuenta. Intentalo de nuevo en unos momentos.");
    }

    const existing = await findPlatformOwnerAuthUserByEmail(email);
    if (existing.error || !existing.data) {
      return err("No se pudo crear la cuenta. Intentalo de nuevo en unos momentos.");
    }

    let hasProfile = false;
    try {
      hasProfile = await profileExists(existing.data.id);
    } catch (error) {
      captureError(error, {
        module: "platform",
        action: "accept_invitation_existing_profile",
        metadata: { emailDomain },
      });
      return err("No se pudo verificar la cuenta existente.");
    }

    if (hasProfile) {
      return err(
        "Este correo ya pertenece a una cuenta de otro salon en GlowBook. " +
          "Cada cuenta puede pertenecer a un solo salon: usa un correo distinto para crear el nuevo salon."
      );
    }

    userId = existing.data.id;
    const updated = await updatePlatformOwnerAuthUser(userId, { password, emailConfirm: true });
    if (updated.error) {
      return err("No se pudo actualizar la cuenta. Intentalo de nuevo en unos momentos.");
    }
  } else {
    userId = created.id;
    createdNewUser = true;
  }

  let salonId: string;
  try {
    salonId = await acceptSalonInvitationAsAdmin({
      token,
      userId,
      email,
      salonName: salon_name,
      fullName: full_name,
    });
  } catch (error) {
    if (createdNewUser) await rollbackCreatedOwner(userId);
    captureError(error, {
      module: "platform",
      action: "accept_invitation",
      metadata: { emailDomain, createdNewUser },
    });
    const message = error instanceof Error ? error.message : "Error desconocido";
    return err(translateAcceptError(message));
  }

  // El salon ya existe: asignar el plan elegido en la invitacion y dejar
  // rastro en auditoria. Si algo falla aqui no se revierte el onboarding;
  // la plataforma puede asignar el plan manualmente desde Suscripciones.
  const warnings: string[] = [];
  if (invitation.plan_id) {
    const assigned = await autoAssignPlanOnAcceptance({
      salonId,
      planId: invitation.plan_id,
      acceptedByUserId: userId,
    });
    if (!assigned.ok) {
      captureError(new Error(assigned.error), {
        module: "platform",
        action: "accept_invitation_assign_plan",
        metadata: { salonId, planId: invitation.plan_id },
      });
    } else {
      warnings.push(...(assigned.warnings ?? []));
    }
  }

  const auditWarnings = await publishAuditEvent("salon.invitation_accepted", {
    actorUserId: userId,
    action: "invitation_accepted",
    status: "succeeded",
    targetSalonId: salonId,
    targetResourceType: "salon_invitation",
    metadata: { emailDomain, planId: invitation.plan_id ?? null },
  });
  warnings.push(...auditWarnings);

  return ok(undefined, warnings);
}
