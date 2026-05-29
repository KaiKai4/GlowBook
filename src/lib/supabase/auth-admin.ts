import "server-only";
import type { AuthError, User } from "@supabase/supabase-js";
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

export async function findAuthUserByEmail(
  email: string
): Promise<AuthAdminResponse<User>> {
  const admin = createSupabaseAdminClient();
  const needle = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { data: null, error };

    const users = data.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === needle);
    if (match) return { data: match, error: null };
    if (users.length < perPage) break;
  }

  return { data: null, error: null };
}
