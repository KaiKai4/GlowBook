"use server";

import { headers } from "next/headers";
import { definePublicAction } from "@/app/_composition/define-public-action";
import { requestPasswordReset } from "@/infra/auth/password-auth";
import { err, ok, type Result } from "@/infra/result";
import { originFromHeaders } from "@/infra/security/same-origin";

// Sin peticion disponible el origen cae a localhost; en produccion siempre hay Host.
const FALLBACK_ORIGIN = "http://localhost";

// Cada envio cuesta un correo: el limite es mas estricto que el de inicio de sesion.
const RESET_REQUEST_LIMIT = { max: 5, windowMs: 15 * 60_000 };

const requestResetFlow = definePublicAction<string, string, void>({
  rateLimit: { scope: "forgot-password", options: RESET_REQUEST_LIMIT },
  parse: (email) => {
    const address = email.trim();
    return address ? ok(address) : err("Escribe el correo de tu cuenta.");
  },
  run: async (address) => {
    const origin = originFromHeaders(await headers(), FALLBACK_ORIGIN);
    // Siempre exito: no revelamos si el correo existe o no (el error se ignora a proposito).
    await requestPasswordReset(address, origin);
    return ok(undefined);
  },
});

export async function requestPasswordResetAction(email: string): Promise<Result<void>> {
  return requestResetFlow(email);
}
