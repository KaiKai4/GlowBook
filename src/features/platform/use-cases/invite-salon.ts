import { err, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/auth/session";
import { z } from "zod";

const InviteSchema = z.object({
  email: z.string().email("Email inválido"),
});

export async function inviteSalon(formData: FormData): Promise<Result<string>> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) return err("No autorizado.");

  const parsed = InviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return err(parsed.error.issues[0].message);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("invite_salon", {
    p_email: parsed.data.email,
  });

  if (error) return err("Error al crear la invitación.");
  return ok(data as string);
}
