import {
  acceptSalonInvitationAsAdmin,
  findSalonInvitationForAcceptance,
  profileExists,
} from "@/features/platform/data/invitations.repo";
import { err, ok, type Result } from "@/lib/result";
import {
  createAuthUser,
  deleteAuthUser,
  findAuthUserByEmail,
  updateAuthUser,
} from "@/lib/supabase/auth-admin";
import { personNameField } from "@/lib/validation/name";
import { z } from "zod";

const AcceptSchema = z.object({
  token: z.string().min(1, "Token invalido"),
  email: z.string().email("Email invalido"),
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
  // The RPC already raises user-facing Spanish messages (token invalido/expirado).
  if (m.includes("invitaci")) return message;
  return "No se pudo crear el salon. Intentalo de nuevo o solicita una nueva invitacion.";
}

async function rollbackCreatedOwner(userId: string): Promise<void> {
  const { error } = await deleteAuthUser(userId);
  if (error && error.status !== 404) {
    console.error("[platform:accept-invitation:rollback]", error);
  }
}

// Server-side acceptance: creates the owner account (email pre-confirmed) and the
// salon atomically using the privileged data adapter. No dependency on email confirmation.
export async function acceptInvitation(input: AcceptInvitationInput): Promise<Result<void>> {
  const parsed = AcceptSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);

  const { token, email, password, salon_name, full_name } = parsed.data;

  let invitation;
  try {
    invitation = await findSalonInvitationForAcceptance(token);
  } catch (error) {
    console.error("[platform:accept-invitation]", error);
    return err("No se pudo verificar la invitacion.");
  }

  if (!invitation || invitation.status !== "pending") {
    return err("Invitacion invalida o ya utilizada.");
  }
  if (new Date(invitation.expires_at) < new Date()) return err("La invitacion expiro.");
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    return err("Esta invitacion fue emitida para otro correo.");
  }

  let userId: string;
  let createdNewUser = false;
  const { data: created, error: createError } = await createAuthUser({
    email,
    password,
    emailConfirm: true,
  });

  if (createError || !created) {
    if (!createError?.message?.toLowerCase().includes("already")) {
      return err("No se pudo crear la cuenta. Intentalo de nuevo en unos momentos.");
    }

    const existing = await findAuthUserByEmail(email);
    if (existing.error || !existing.data) {
      return err("No se pudo crear la cuenta. Intentalo de nuevo en unos momentos.");
    }

    let hasProfile = false;
    try {
      hasProfile = await profileExists(existing.data.id);
    } catch (error) {
      console.error("[platform:accept-invitation]", error);
      return err("No se pudo verificar la cuenta existente.");
    }

    if (hasProfile) {
      return err(
        "Este correo ya pertenece a una cuenta de otro salon en GlowBook. " +
          "Cada cuenta puede pertenecer a un solo salon: usa un correo distinto para crear el nuevo salon."
      );
    }

    userId = existing.data.id;
    const updated = await updateAuthUser(userId, { password, emailConfirm: true });
    if (updated.error) {
      return err("No se pudo actualizar la cuenta. Intentalo de nuevo en unos momentos.");
    }
  } else {
    userId = created.id;
    createdNewUser = true;
  }

  try {
    await acceptSalonInvitationAsAdmin({
      token,
      userId,
      email,
      salonName: salon_name,
      fullName: full_name,
    });
  } catch (error) {
    if (createdNewUser) await rollbackCreatedOwner(userId);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return err(translateAcceptError(message));
  }

  return ok(undefined);
}
