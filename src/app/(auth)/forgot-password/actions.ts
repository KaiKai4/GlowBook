"use server";

import { headers } from "next/headers";
import { requestPasswordReset } from "@/infra/auth/password-auth";
import { err, ok, type Result } from "@/infra/result";
import { originFromHeaders } from "@/infra/security/same-origin";

// Sin peticion disponible el origen cae a localhost; en produccion siempre hay Host.
const FALLBACK_ORIGIN = "http://localhost";

export async function requestPasswordResetAction(email: string): Promise<Result<void>> {
  const address = email.trim();
  if (!address) return err("Escribe el correo de tu cuenta.");

  const origin = originFromHeaders(await headers(), FALLBACK_ORIGIN);
  // Siempre exito: no revelamos si el correo existe o no (el error se ignora a proposito).
  await requestPasswordReset(address, origin);
  return ok(undefined);
}
