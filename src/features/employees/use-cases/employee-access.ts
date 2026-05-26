import { randomBytes } from "crypto";
import { findEmployeeById } from "@/features/employees/data/employees.repo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Result } from "@/lib/result";

export interface EmployeeInviteResult {
  token: string;
  expiresAt: string;
}

async function validateAssignableRoleId(
  salonId: string,
  roleId: string | null
): Promise<Result<string | null>> {
  if (!roleId) return { ok: true, value: null };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("salon_id", salonId)
    .eq("is_system", false)
    .maybeSingle();

  if (error) {
    console.error("[employees:access]", error);
    return { ok: false, error: "No se pudo verificar el rol del colaborador." };
  }

  if (!data) {
    return { ok: false, error: "El rol seleccionado no es valido para este salon." };
  }

  return { ok: true, value: data.id };
}

export async function replacePendingEmployeeInvitation({
  employeeId,
  salonId,
  email,
  roleId,
}: {
  employeeId: string;
  salonId: string;
  email: string;
  roleId: string | null;
}): Promise<Result<EmployeeInviteResult>> {
  const admin = createSupabaseAdminClient();
  const assignableRole = await validateAssignableRoleId(salonId, roleId);
  if (!assignableRole.ok) return assignableRole;

  const { error: deleteInviteError } = await admin
    .from("employee_invitations")
    .delete()
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId)
    .is("accepted_at", null);

  if (deleteInviteError) {
    console.error("[employees:access]", deleteInviteError);
    return { ok: false, error: "No se pudo invalidar el enlace anterior del colaborador." };
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: inviteError } = await admin.from("employee_invitations").insert({
    employee_id: employeeId,
    salon_id: salonId,
    email,
    role_id: assignableRole.value,
    token,
    expires_at: expiresAt,
  });

  if (inviteError) {
    console.error("[employees:access]", inviteError);
    return { ok: false, error: "No se pudo generar el nuevo enlace de acceso." };
  }

  return { ok: true, value: { token, expiresAt } };
}

export async function generateEmployeeInvitation({
  employeeId,
  salonId,
  email,
  roleId,
}: {
  employeeId: string;
  salonId: string;
  email: string;
  roleId: string | null;
}): Promise<Result<EmployeeInviteResult>> {
  return replacePendingEmployeeInvitation({
    employeeId,
    salonId,
    email,
    roleId,
  });
}

export async function revokeEmployeeAuthAccess(
  employeeId: string,
  salonId: string,
  profileId: string
): Promise<Result<{ roleId: string | null }>> {
  const admin = createSupabaseAdminClient();
  const { data: linkedProfile, error: profileError } = await admin
    .from("profiles")
    .select("role_id, is_owner")
    .eq("id", profileId)
    .eq("salon_id", salonId)
    .maybeSingle();

  if (profileError) {
    console.error("[employees:access]", profileError);
    return { ok: false, error: "No se pudo verificar el acceso actual del colaborador." };
  }

  if (linkedProfile?.is_owner) {
    return { ok: false, error: "No se puede reiniciar el acceso de un owner desde colaboradores." };
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(profileId);
  if (deleteUserError) {
    console.error("[employees:access]", deleteUserError);
    return { ok: false, error: "No se pudo revocar la cuenta anterior del colaborador." };
  }

  const { error: unlinkError } = await admin
    .from("employees")
    .update({ profile_id: null })
    .eq("id", employeeId)
    .eq("salon_id", salonId);

  if (unlinkError) {
    console.error("[employees:access]", unlinkError);
    return { ok: false, error: "La cuenta fue revocada, pero no se pudo desvincular el colaborador." };
  }

  return { ok: true, value: { roleId: linkedProfile?.role_id ?? null } };
}

export async function revokeEmployeeAccessForArchive({
  employeeId,
  salonId,
  profileId,
}: {
  employeeId: string;
  salonId: string;
  profileId: string | null;
}): Promise<Result<void>> {
  const admin = createSupabaseAdminClient();

  if (profileId) {
    const { data: linkedProfile, error: profileError } = await admin
      .from("profiles")
      .select("is_owner")
      .eq("id", profileId)
      .eq("salon_id", salonId)
      .maybeSingle();

    if (profileError) {
      console.error("[employees:access]", profileError);
      return { ok: false, error: "Error al verificar el acceso del colaborador." };
    }

    if (linkedProfile?.is_owner) {
      return { ok: false, error: "No se puede eliminar un owner desde colaboradores." };
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(profileId);
    if (authDeleteError) {
      console.error("[employees:access]", authDeleteError);
      return { ok: false, error: "No se pudo revocar el acceso del colaborador." };
    }
  }

  const { error: inviteCleanupError } = await admin
    .from("employee_invitations")
    .delete()
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId);

  if (inviteCleanupError) {
    console.error("[employees:access]", inviteCleanupError);
    return { ok: false, error: "No se pudo limpiar la invitación del colaborador." };
  }

  return { ok: true, value: undefined };
}

export async function changeEmployeeRole(
  salonId: string,
  profileId: string,
  roleId: string | null
): Promise<Result<void>> {
  const admin = createSupabaseAdminClient();
  const assignableRole = await validateAssignableRoleId(salonId, roleId);
  if (!assignableRole.ok) return assignableRole;

  const { error } = await admin
    .from("profiles")
    .update({ role_id: assignableRole.value })
    .eq("id", profileId)
    .eq("salon_id", salonId);

  if (error) {
    console.error("[employees:access]", error);
    return { ok: false, error: "Error al cambiar el rol." };
  }

  return { ok: true, value: undefined };
}

export async function resetEmployeeAccess({
  employeeId,
  salonId,
  roleId,
}: {
  employeeId: string;
  salonId: string;
  roleId: string | null;
}): Promise<Result<EmployeeInviteResult>> {
  const employee = await findEmployeeById(employeeId, salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };

  const email = employee.email?.trim();
  if (!email) return { ok: false, error: "Este colaborador no tiene email registrado." };

  let inviteRoleId = roleId || null;
  if (employee.profile_id) {
    const revoked = await revokeEmployeeAuthAccess(employeeId, salonId, employee.profile_id);
    if (!revoked.ok) return revoked;
    inviteRoleId = inviteRoleId || revoked.value.roleId;
  }

  return replacePendingEmployeeInvitation({
    employeeId,
    salonId,
    email,
    roleId: inviteRoleId,
  });
}

export async function createEmployeeInviteForExistingEmployee({
  employeeId,
  salonId,
  roleId,
}: {
  employeeId: string;
  salonId: string;
  roleId: string | null;
}): Promise<Result<EmployeeInviteResult>> {
  const employee = await findEmployeeById(employeeId, salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };
  if (!employee.email?.trim()) return { ok: false, error: "Este colaborador no tiene email registrado." };
  if (employee.profile_id) return { ok: false, error: "Este colaborador ya tiene acceso al sistema." };

  return generateEmployeeInvitation({
    employeeId,
    salonId,
    email: employee.email.trim(),
    roleId: roleId || null,
  });
}
