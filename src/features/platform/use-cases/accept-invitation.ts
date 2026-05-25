import { err, ok, type Result } from "@/lib/result";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { personNameField } from "@/lib/validation/name";
import { z } from "zod";

const AcceptSchema = z.object({
  token: z.string().min(1, "Token inválido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  salon_name: z.string().min(1, "El nombre del salón es obligatorio").max(120),
  full_name: personNameField("Tu nombre es obligatorio", "Tu nombre"),
});

export type AcceptInvitationInput = z.infer<typeof AcceptSchema>;

// Translates raw Postgres / RPC errors into messages a non-technical user can act on.
function translateAcceptError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("profiles_pkey") || m.includes("duplicate key")) {
    return (
      "Este correo ya pertenece a una cuenta de otro salón en GlowBook. " +
      "Cada cuenta puede pertenecer a un solo salón: usa un correo distinto para crear el nuevo salón."
    );
  }
  // The RPC already raises user-facing Spanish messages (token inválido/expirado…).
  if (m.includes("invitaci")) return message;
  return "No se pudo crear el salón. Inténtalo de nuevo o solicita una nueva invitación.";
}

// Server-side acceptance: creates the owner account (email pre-confirmed) and the
// salon atomically using the service_role. No dependency on email confirmation.
export async function acceptInvitation(input: AcceptInvitationInput): Promise<Result<void>> {
  const parsed = AcceptSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0].message);

  const { token, email, password, salon_name, full_name } = parsed.data;
  const admin = createSupabaseAdminClient();

  // Validate invitation up-front (clear errors before creating any user)
  const { data: inv } = await admin
    .from("salon_invitations")
    .select("email, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!inv || inv.status !== "pending") return err("Invitación inválida o ya utilizada.");
  if (new Date(inv.expires_at) < new Date()) return err("La invitación expiró.");
  if (inv.email.toLowerCase() !== email.toLowerCase()) {
    return err("Esta invitación fue emitida para otro correo.");
  }

  // Create the owner account (or reuse + confirm an existing one).
  let userId: string;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    // Only the "email already registered" error has a recovery path; anything else fails.
    if (!createErr.message?.toLowerCase().includes("already")) {
      return err("No se pudo crear la cuenta. Inténtalo de nuevo en unos momentos.");
    }
    // Supabase Auth doesn't expose getUserByEmail, so we paginate.
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) return err("No se pudo crear la cuenta. Inténtalo de nuevo en unos momentos.");

    // If that account already belongs to a salon (has a profile), it can't own a second
    // one — each account belongs to exactly one salon. Surface that clearly instead of
    // letting the profile insert blow up with a raw "profiles_pkey" constraint error.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", existing.id)
      .maybeSingle();
    if (existingProfile) {
      return err(
        "Este correo ya pertenece a una cuenta de otro salón en GlowBook. " +
          "Cada cuenta puede pertenecer a un solo salón: usa un correo distinto para crear el nuevo salón."
      );
    }

    // Orphaned auth user (a previous attempt that never finished): reuse it.
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  } else {
    userId = created.user.id;
  }

  // Create the salon + owner profile atomically.
  const { error: rpcErr } = await admin.rpc("accept_invitation_admin", {
    p_token: token,
    p_user_id: userId,
    p_email: email,
    p_salon_name: salon_name,
    p_full_name: full_name,
  });

  if (rpcErr) return err(translateAcceptError(rpcErr.message));

  return ok(undefined);
}
