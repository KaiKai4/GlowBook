// Reglas puras de aceptación de invitaciones de salón. No acceden a base de datos ni a red.

export interface InvitationForAcceptance {
  email: string;
  status: string;
  expires_at: string;
  plan_id: string | null;
}

/**
 * Motivo por el que la invitación no puede aceptarse, o null si puede aceptarse.
 * El orden importa: primero estado, luego caducidad y por último el correo.
 */
export function invitationRejection(input: {
  invitation: InvitationForAcceptance | null;
  email: string;
  now: Date;
}): string | null {
  const { invitation, email, now } = input;
  if (!invitation || invitation.status !== "pending") return "Invitacion inválida o ya utilizada.";
  if (new Date(invitation.expires_at) < now) return "La invitacion expiro.";
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    return "Esta invitacion fue emitida para otro correo.";
  }
  return null;
}

/** Plan a asignar al aceptar: el de la invitación, si lo tiene. */
export function planToAssign(invitation: Pick<InvitationForAcceptance, "plan_id">): string | null {
  return invitation.plan_id ?? null;
}

/** El proveedor de identidad indica que el correo ya existe al intentar crear la cuenta. */
export function isAlreadyRegisteredError(message: string | null | undefined): boolean {
  return (message ?? "").toLowerCase().includes("already");
}

export const DUPLICATE_OWNER_MESSAGE =
  "Este correo ya pertenece a una cuenta de otro salon en GlowBook. " +
  "Cada cuenta puede pertenecer a un solo salon: usa un correo distinto para crear el nuevo salon.";

// Traduce errores crudos de Postgres o RPC a mensajes que el usuario puede seguir.
export function translateAcceptError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("profiles_pkey") || m.includes("duplicate key")) return DUPLICATE_OWNER_MESSAGE;
  // La RPC ya lanza mensajes en español para el usuario (token inválido o expirado).
  if (m.includes("invitaci")) return message;
  return "No se pudo crear el salon. Intentalo de nuevo o solicita una nueva invitacion.";
}
