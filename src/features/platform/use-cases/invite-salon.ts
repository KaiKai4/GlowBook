import { createSalonInvitation } from "@/features/platform/data/invitations.repo";
import { err, ok, type Result } from "@/lib/result";
import { isPlatformAdmin } from "@/lib/auth/session";
import { z } from "zod";

const InviteSchema = z.object({
  email: z.string().email("Email invalido"),
});

export type InviteSalonInput = z.infer<typeof InviteSchema>;

export async function inviteSalon(input: InviteSalonInput): Promise<Result<string>> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) return err("No autorizado.");

  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);

  try {
    const token = await createSalonInvitation(parsed.data.email);
    return ok(token);
  } catch (error) {
    console.error("[platform:invite-salon]", error);
    return err("Error al crear la invitacion.");
  }
}
