import "server-only";

import {
  createAuthUser,
  deleteAuthUser,
  findAuthUserByEmail,
  updateAuthUser,
  type AuthAdminResponse,
  type CreateAuthUserInput,
  type UpdateAuthUserInput,
} from "@/lib/supabase/auth-admin";
import type { User } from "@supabase/supabase-js";

export function createPlatformOwnerAuthUser(
  input: CreateAuthUserInput
): Promise<AuthAdminResponse<User>> {
  return createAuthUser(input);
}

export function deletePlatformOwnerAuthUser(
  userId: string
): Promise<AuthAdminResponse<void>> {
  return deleteAuthUser(userId);
}

export function findPlatformOwnerAuthUserByEmail(
  email: string
): Promise<AuthAdminResponse<User>> {
  return findAuthUserByEmail(email);
}

export function updatePlatformOwnerAuthUser(
  userId: string,
  input: UpdateAuthUserInput
): Promise<AuthAdminResponse<User>> {
  return updateAuthUser(userId, input);
}
