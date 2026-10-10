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
import {
  DUPLICATE_OWNER_MESSAGE,
  invitationRejection,
  isAlreadyRegisteredError,
  planToAssign,
  translateAcceptError,
} from "@/features/platform/domain/invitation-rules";

const AcceptSchema = z.object({
  token: z.string().min(1, "Token inválido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  salon_name: z.string().min(1, "El nombre del salón es obligatorio").max(120),
  full_name: personNameField("Tu nombre es obligatorio", "Tu nombre"),
});

export type AcceptInvitationInput = z.infer<typeof AcceptSchema>;

/** Dependencias del caso de uso. Producción usa las funciones reales; los tests inyectan fakes. */
export interface AcceptInvitationDeps {
  findInvitation: typeof findSalonInvitationForAcceptance;
  profileExists: typeof profileExists;
  acceptSalonAsAdmin: typeof acceptSalonInvitationAsAdmin;
  createOwnerAuthUser: typeof createPlatformOwnerAuthUser;
  deleteOwnerAuthUser: typeof deletePlatformOwnerAuthUser;
  findOwnerAuthUserByEmail: typeof findPlatformOwnerAuthUserByEmail;
  updateOwnerAuthUser: typeof updatePlatformOwnerAuthUser;
  autoAssignPlan: typeof autoAssignPlanOnAcceptance;
  publishAuditEvent: typeof publishAuditEvent;
}

const defaultAcceptInvitationDeps: AcceptInvitationDeps = {
  findInvitation: findSalonInvitationForAcceptance,
  profileExists,
  acceptSalonAsAdmin: acceptSalonInvitationAsAdmin,
  createOwnerAuthUser: createPlatformOwnerAuthUser,
  deleteOwnerAuthUser: deletePlatformOwnerAuthUser,
  findOwnerAuthUserByEmail: findPlatformOwnerAuthUserByEmail,
  updateOwnerAuthUser: updatePlatformOwnerAuthUser,
  autoAssignPlan: autoAssignPlanOnAcceptance,
  publishAuditEvent,
};

const ACCOUNT_CREATE_FAILED = "No se pudo crear la cuenta. Intentalo de nuevo en unos momentos.";

async function rollbackCreatedOwner(userId: string, deps: AcceptInvitationDeps): Promise<void> {
  const { error } = await deps.deleteOwnerAuthUser(userId);
  if (error && error.status !== 404) {
    captureError(error, {
      module: "platform",
      action: "accept_invitation_rollback",
      metadata: { userId },
    });
  }
}

// Reutiliza la cuenta existente del correo, si no tiene salón todavía, y le fija la contraseña nueva.
async function reuseExistingOwner(
  email: string,
  password: string,
  emailDomain: string,
  deps: AcceptInvitationDeps
): Promise<Result<string>> {
  const existing = await deps.findOwnerAuthUserByEmail(email);
  if (existing.error || !existing.data) return err(ACCOUNT_CREATE_FAILED);

  let hasProfile = false;
  try {
    hasProfile = await deps.profileExists(existing.data.id);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "accept_invitation_existing_profile",
      metadata: { emailDomain },
    });
    return err("No se pudo verificar la cuenta existente.");
  }
  if (hasProfile) return err(DUPLICATE_OWNER_MESSAGE);

  const updated = await deps.updateOwnerAuthUser(existing.data.id, { password, emailConfirm: true });
  if (updated.error) {
    return err("No se pudo actualizar la cuenta. Intentalo de nuevo en unos momentos.");
  }
  return ok(existing.data.id);
}

// Crea la cuenta del owner con el correo confirmado, o reutiliza una existente sin salón.
// Devuelve el id de usuario y si se creó en esta operación (para poder revertirla).
async function resolveOwnerAccount(
  email: string,
  password: string,
  emailDomain: string,
  deps: AcceptInvitationDeps
): Promise<Result<{ userId: string; createdNewUser: boolean }>> {
  const { data: created, error: createError } = await deps.createOwnerAuthUser({
    email,
    password,
    emailConfirm: true,
  });

  if (createError || !created) {
    if (!isAlreadyRegisteredError(createError?.message)) return err(ACCOUNT_CREATE_FAILED);
    const reused = await reuseExistingOwner(email, password, emailDomain, deps);
    if (!reused.ok) return reused;
    return ok({ userId: reused.value, createdNewUser: false });
  }
  return ok({ userId: created.id, createdNewUser: true });
}

// Asigna el plan elegido en la invitación. Si falla no se revierte el onboarding:
// la plataforma puede asignarlo manualmente desde Suscripciones.
async function assignInvitedPlan(
  salonId: string,
  planId: string,
  userId: string,
  deps: AcceptInvitationDeps
): Promise<string[]> {
  const assigned = await deps.autoAssignPlan({ salonId, planId, acceptedByUserId: userId });
  if (!assigned.ok) {
    captureError(new Error(assigned.error), {
      module: "platform",
      action: "accept_invitation_assign_plan",
      metadata: { salonId, planId },
    });
    return [];
  }
  return assigned.warnings ?? [];
}

// Server-side acceptance: creates the owner account (email pre-confirmed) and the
// salon atomically using the privileged data adapter. No dependency on email confirmation.
export async function acceptInvitation(
  input: AcceptInvitationInput,
  deps: AcceptInvitationDeps = defaultAcceptInvitationDeps
): Promise<Result<void>> {
  const parsed = AcceptSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));

  const { token, email, password, salon_name, full_name } = parsed.data;
  const emailDomain = email.split("@").at(-1) ?? "unknown";

  let invitation;
  try {
    invitation = await deps.findInvitation(token);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "accept_invitation_lookup",
      metadata: { emailDomain },
    });
    return err("No se pudo verificar la invitación.");
  }

  const rejection = invitationRejection({ invitation, email, now: new Date() });
  if (rejection || !invitation) return err(rejection ?? "Invitación inválida o ya utilizada.");

  const owner = await resolveOwnerAccount(email, password, emailDomain, deps);
  if (!owner.ok) return owner;
  const { userId, createdNewUser } = owner.value;

  let salonId: string;
  try {
    salonId = await deps.acceptSalonAsAdmin({
      token,
      userId,
      email,
      salonName: salon_name,
      fullName: full_name,
    });
  } catch (error) {
    if (createdNewUser) await rollbackCreatedOwner(userId, deps);
    captureError(error, {
      module: "platform",
      action: "accept_invitation",
      metadata: { emailDomain, createdNewUser },
    });
    const message = error instanceof Error ? error.message : "Error desconocido";
    return err(translateAcceptError(message));
  }

  const warnings: string[] = [];
  const planId = planToAssign(invitation);
  if (planId) warnings.push(...(await assignInvitedPlan(salonId, planId, userId, deps)));

  const auditWarnings = await deps.publishAuditEvent("salon.invitation_accepted", {
    actorUserId: userId,
    action: "invitation_accepted",
    status: "succeeded",
    targetSalonId: salonId,
    targetResourceType: "salon_invitation",
    metadata: { emailDomain, planId: planId },
  });
  warnings.push(...auditWarnings);

  return ok(undefined, warnings);
}
