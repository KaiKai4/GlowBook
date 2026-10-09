"use server";

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

/**
 * Valida el enlace de recuperacion. Prioridad: code (PKCE), luego token_hash y,
 * sin parametros, una sesion de recuperacion ya abierta.
 */
export async function verifyRecoveryLinkAction(link: {
  code: string | null;
  tokenHash: string | null;
}): Promise<boolean> {
  return establishRecoverySession(toRecoveryLink(link));
}

export async function updatePasswordAction(password: string): Promise<Result<void>> {
  const parsed = PasswordSchema.safeParse(password);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));

  const { error } = await updateCurrentPassword(parsed.data);
  if (error) return err(UPDATE_ERROR);

  // Cerramos la sesion de recuperacion para que entre con la nueva clave.
  await signOutCurrentSession();
  return ok(undefined);
}

function toRecoveryLink({ code, tokenHash }: { code: string | null; tokenHash: string | null }): RecoveryLink {
  if (code) return { kind: "code", code };
  if (tokenHash) return { kind: "token_hash", tokenHash };
  return { kind: "session" };
}
