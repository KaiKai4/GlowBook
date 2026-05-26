"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Result } from "@/lib/result";

export async function acceptEmployeeInvitationAction(
  token: string,
  password: string
): Promise<Result<void>> {
  if (!password || password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const admin = createSupabaseAdminClient();

  // Load invitation (admin client bypasses RLS)
  const { data: inv } = await admin
    .from("employee_invitations")
    .select("id, employee_id, salon_id, email, role_id, expires_at, accepted_at")
    .eq("token", token)
    .single();

  if (!inv) return { ok: false, error: "El enlace no es válido." };
  if (inv.accepted_at) return { ok: false, error: "Este enlace ya fue utilizado." };
  if (new Date(inv.expires_at) < new Date()) {
    return { ok: false, error: "Este enlace ha expirado. Solicita uno nuevo al administrador." };
  }

  // Fetch employee name for the profile
  const { data: emp } = await admin
    .from("employees")
    .select("first_name, last_name")
    .eq("id", inv.employee_id)
    .single();

  if (!emp) return { ok: false, error: "Colaborador no encontrado." };

  let roleId: string | null = null;
  if (inv.role_id) {
    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("id")
      .eq("id", inv.role_id)
      .eq("salon_id", inv.salon_id)
      .eq("is_system", false)
      .maybeSingle();

    if (roleError) {
      console.error("[employee-join]", roleError);
      return { ok: false, error: "No se pudo verificar el rol de la invitacion." };
    }

    if (!role) {
      return { ok: false, error: "Este enlace tiene un rol invalido. Solicita un enlace nuevo." };
    }

    roleId = role.id;
  }

  // Create the auth user (pre-confirmed, no email needed)
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: inv.email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message?.includes("already registered") || authError.message?.includes("already exists")) {
      return { ok: false, error: "Este email ya tiene una cuenta registrada. Contacta al administrador." };
    }
    return { ok: false, error: "Error al crear la cuenta. Intenta de nuevo." };
  }

  const userId = created.user.id;

  // Create profile linked to the salon
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    salon_id: inv.salon_id,
    full_name: `${emp.first_name} ${emp.last_name}`,
    is_owner: false,
    role_id: roleId,
  });

  if (profileError) {
    // Rollback user creation to keep state clean
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "Error al configurar el perfil. Intenta de nuevo." };
  }

  // Link the employee record to the new user profile
  const { error: empError } = await admin
    .from("employees")
    .update({ profile_id: userId })
    .eq("id", inv.employee_id);

  if (empError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "Error al vincular el colaborador. Intenta de nuevo." };
  }

  // Mark invitation as accepted
  await admin
    .from("employee_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inv.id);

  redirect("/login?joined=1");
}
