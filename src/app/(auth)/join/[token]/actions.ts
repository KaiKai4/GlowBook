"use server";

import { redirect } from "next/navigation";
import { acceptEmployeeInvitation } from "@/features/employees/use-cases/employee-invitations";
import type { Result } from "@/lib/result";

export async function acceptEmployeeInvitationAction(
  token: string,
  password: string
): Promise<Result<void>> {
  const result = await acceptEmployeeInvitation({ token, password });
  if (!result.ok) return result;

  redirect("/login?joined=1");
}
