"use server";

import { redirect } from "next/navigation";
import { acceptEmployeeInvitation } from "@/features/employees/use-cases/employee-invitations";
import { assertAnonymousRateLimit } from "@/lib/security/rate-limit";
import type { Result } from "@/lib/result";

export async function acceptEmployeeInvitationAction(
  token: string,
  password: string
): Promise<Result<void>> {
  // Endpoint sin sesion: limitar por IP frena la fuerza bruta de tokens.
  const limited = await assertAnonymousRateLimit("join-invitation");
  if (!limited.ok) return limited;

  const result = await acceptEmployeeInvitation({ token, password });
  if (!result.ok) return result;

  redirect("/login?joined=1");
}
