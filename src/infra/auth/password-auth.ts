import "server-only";
import { cookies } from "next/headers";
import type { AuthError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { SESSION_ONLY_COOKIE } from "@/infra/supabase/session-persistence";
import { isAuthInfrastructureError } from "./session";

// Primitivas de autenticacion con contraseña para las acciones de (auth).
// Sin reglas de negocio ni mensajes para el usuario: eso vive en cada accion.
// Las cookies de sesion se escriben aqui, en el servidor, nunca desde el browser.

export interface AuthOutcome {
  error: AuthError | null;
}

/**
 * Marca o limpia el modo "solo esta sesion" (recordarme desmarcado). Debe
 * escribirse antes del sign-in para que las cookies de auth nazcan con la
 * persistencia correcta. Mismo formato que el marcador del browser.
 */
async function setRememberSession(remember: boolean): Promise<void> {
  const cookieStore = await cookies();
  if (remember) {
    cookieStore.set(SESSION_ONLY_COOKIE, "", { path: "/", sameSite: "lax", maxAge: 0 });
  } else {
    cookieStore.set(SESSION_ONLY_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: false });
  }
}

/**
 * Inicia sesion con correo y contraseña. Si `remember` viene informado, primero
 * se escribe el marcador y la sesion sigue esa preferencia. Sin `remember` se
 * respeta el marcador que ya tenga el navegador (como hacia el cliente anterior).
 */
export async function signInWithPassword(input: {
  email: string;
  password: string;
  remember?: boolean;
}): Promise<AuthOutcome> {
  if (input.remember !== undefined) await setRememberSession(input.remember);

  const supabase = await createSupabaseServerClient(
    input.remember === undefined ? {} : { sessionOnly: !input.remember }
  );
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  return { error };
}

/** Envia el correo de recuperacion. `origin` construye el enlace de vuelta. */
export async function requestPasswordReset(email: string, origin: string): Promise<AuthOutcome> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  return { error };
}

export type RecoveryLink =
  | { kind: "code"; code: string }
  | { kind: "token_hash"; tokenHash: string }
  | { kind: "session" };

/**
 * Canjea el enlace de recuperacion por una sesion temporal. Devuelve false si el
 * enlace no es valido o esta vencido (y no hay sesion de recuperacion abierta).
 */
export async function establishRecoverySession(link: RecoveryLink): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  if (link.kind === "code") {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);
    return error === null;
  }
  if (link.kind === "token_hash") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: link.tokenHash });
    return error === null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (isAuthInfrastructureError(error)) throw error;
  return data.user !== null;
}

/** Cambia la contraseña de la sesion actual. */
export async function updateCurrentPassword(password: string): Promise<AuthOutcome> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  return { error };
}

/** Cierra la sesion actual en el servidor (borra las cookies de auth). */
export async function signOutCurrentSession(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
