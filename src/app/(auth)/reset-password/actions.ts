"use server";

import { definePublicAction } from "@/app/_composition/define-public-action";
import {
  establishRecoverySession,
  signOutCurrentSession,
  updateCurrentPassword,
  type RecoveryLink,
} from "@/infra/auth/password-auth";
import { PasswordSchema } from "@/infra/auth/password-schemas";
import { err, ok, type Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";

const UPDATE_ERROR = "No se pudo actualizar la contraseña. Pide un enlace nuevo e intentalo otra vez.";

// Ventana de 15 minutos por IP para validar enlaces y cambiar la contraseña.
const RECOVERY_LIMIT = { max: 10, windowMs: 15 * 60_000 };

type RecoveryLinkRaw = { code: string | null; tokenHash: string | null };

const verifyLinkFlow = definePublicAction<RecoveryLinkRaw, RecoveryLink, boolean>({
  rateLimit: { scope: "verify-recovery-link", options: RECOVERY_LIMIT },
  parse: (raw) => ok(toRecoveryLink(raw)),
  run: async (link) => ok(await establishRecoverySession(link)),
});

const updatePasswordFlow = definePublicAction<string, string, void>({
  rateLimit: { scope: "update-password", options: RECOVERY_LIMIT },
  parse: (password) => {
    const parsed = PasswordSchema.safeParse(password);
    return parsed.success ? ok(parsed.data) : err(firstIssueMessage(parsed.error));
  },
  run: async (password) => {
    const { error } = await updateCurrentPassword(password);
    if (error) return err(UPDATE_ERROR);

    // Cerramos la sesion de recuperacion para que entre con la nueva clave.
    await signOutCurrentSession();
    return ok(undefined);
  },
});

/**
 * Valida el enlace de recuperacion. Prioridad: code (PKCE), luego token_hash y,
 * sin parametros, una sesion de recuperacion ya abierta. Un enlace bloqueado por
 * el limite cuenta como no valido.
 */
export async function verifyRecoveryLinkAction(link: RecoveryLinkRaw): Promise<boolean> {
  const result = await verifyLinkFlow(link);
  return result.ok ? result.value : false;
}

export async function updatePasswordAction(password: string): Promise<Result<void>> {
  return updatePasswordFlow(password);
}

function toRecoveryLink({ code, tokenHash }: RecoveryLinkRaw): RecoveryLink {
  if (code) return { kind: "code", code };
  if (tokenHash) return { kind: "token_hash", tokenHash };
  return { kind: "session" };
}
