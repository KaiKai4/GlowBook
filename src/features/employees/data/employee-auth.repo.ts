import "server-only";

import {
  createAuthUser,
  deleteAuthUser,
  type AuthAdminResponse,
  type CreateAuthUserInput,
} from "@/infra/supabase/auth-admin";
import type { User } from "@supabase/supabase-js";

export function createEmployeeAuthUser(
  input: CreateAuthUserInput
): Promise<AuthAdminResponse<User>> {
  return createAuthUser(input);
}

export function deleteEmployeeAuthUser(
  userId: string
): Promise<AuthAdminResponse<void>> {
  return deleteAuthUser(userId);
}
