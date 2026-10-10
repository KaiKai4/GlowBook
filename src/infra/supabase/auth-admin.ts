import "server-only";
import { AuthError, type User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./admin";

export interface CreateAuthUserInput {
  email: string;
  password: string;
  emailConfirm?: boolean;
}

export interface UpdateAuthUserInput {
  password?: string;
  emailConfirm?: boolean;
}

export type AuthAdminResponse<T> = {
  data: T | null;
  error: AuthError | null;
};

export async function createAuthUser({
  email,
  password,
  emailConfirm = true,
}: CreateAuthUserInput): Promise<AuthAdminResponse<User>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: emailConfirm,
  });

  return { data: data.user ?? null, error };
}

export async function deleteAuthUser(
  userId: string
): Promise<AuthAdminResponse<void>> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  return { data: error ? null : undefined, error };
}

export async function updateAuthUser(
  userId: string,
  input: UpdateAuthUserInput
): Promise<AuthAdminResponse<User>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password: input.password,
    email_confirm: input.emailConfirm,
  });

  return { data: data.user ?? null, error };
}

/**
 * Busca un usuario de Auth por email en una sola consulta (RPC find_auth_user_id_by_email, con
 * normalizacion lower/trim en la base). Sin coincidencia devuelve data null y sin error.
 */
export async function findAuthUserByEmail(
  email: string
): Promise<AuthAdminResponse<User>> {
  const admin = createSupabaseAdminClient();
  const { data: userId, error } = await admin.rpc("find_auth_user_id_by_email", { p_email: email });
  if (error) return { data: null, error: new AuthError(error.message, 500, error.code) };
  if (!userId) return { data: null, error: null };

  const { data, error: getError } = await admin.auth.admin.getUserById(userId);
  return { data: data.user ?? null, error: getError };
}
