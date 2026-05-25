"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import {
  createEmployee,
  updateEmployee,
  updateEmployeeServices,
  updateEmployeeCategories,
  upsertWorkSchedule,
  deleteWorkSchedule,
  findEmployeeById,
  findEmployeeByEmail,
} from "@/features/employees/data/employees.repo";
import { CreateEmployeeSchema, WorkScheduleSchema } from "@/features/employees/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Result } from "@/lib/result";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar colaboradores." };
  }
  return { ok: true, value: { salonId: profile.salon_id } };
}

export interface CreateEmployeeResult {
  id: string;
  inviteToken?: string;
  inviteExpiresAt?: string;
}

export interface ArchivedEmployeeMatch {
  id: string;
  name: string;
  email: string;
}

async function replacePendingEmployeeInvitation({
  employeeId,
  salonId,
  email,
  roleId,
}: {
  employeeId: string;
  salonId: string;
  email: string;
  roleId: string | null;
}): Promise<Result<{ token: string; expiresAt: string }>> {
  const admin = createSupabaseAdminClient();

  const { error: deleteInviteError } = await admin
    .from("employee_invitations")
    .delete()
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId)
    .is("accepted_at", null);

  if (deleteInviteError) {
    console.error("[employees]", deleteInviteError);
    return { ok: false, error: "No se pudo invalidar el enlace anterior del colaborador." };
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: inviteError } = await admin.from("employee_invitations").insert({
    employee_id: employeeId,
    salon_id: salonId,
    email,
    role_id: roleId,
    token,
    expires_at: expiresAt,
  });

  if (inviteError) {
    console.error("[employees]", inviteError);
    return { ok: false, error: "No se pudo generar el nuevo enlace de acceso." };
  }

  return { ok: true, value: { token, expiresAt } };
}

async function revokeEmployeeAuthAccess(
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
    console.error("[employees]", profileError);
    return { ok: false, error: "No se pudo verificar el acceso actual del colaborador." };
  }
  if (linkedProfile?.is_owner) {
    return { ok: false, error: "No se puede reiniciar el acceso de un owner desde colaboradores." };
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(profileId);
  if (deleteUserError) {
    console.error("[employees]", deleteUserError);
    return { ok: false, error: "No se pudo revocar la cuenta anterior del colaborador." };
  }

  const { error: unlinkError } = await admin
    .from("employees")
    .update({ profile_id: null })
    .eq("id", employeeId)
    .eq("salon_id", salonId);

  if (unlinkError) {
    console.error("[employees]", unlinkError);
    return { ok: false, error: "La cuenta fue revocada, pero no se pudo desvincular el colaborador." };
  }

  return { ok: true, value: { roleId: linkedProfile?.role_id ?? null } };
}

export async function createEmployeeAction(
  _prev: Result<CreateEmployeeResult> | null,
  formData: FormData
): Promise<Result<CreateEmployeeResult>> {
  const g = await guard();
  if (!g.ok) return g;

  const roleId = (formData.get("role_id") as string)?.trim() || null;

  const parsed = CreateEmployeeSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    specialty: formData.get("specialty") ?? "",
    commission_percentage: Number(formData.get("commission_percentage") ?? 0),
    service_ids: formData.getAll("service_ids").map(String),
    category_ids: formData.getAll("category_ids").map(String),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const { service_ids, category_ids, ...employee } = parsed.data;
    const email = employee.email?.trim();
    if (email) {
      const archived = await findEmployeeByEmail(email, g.value.salonId);
      if (archived && !archived.is_active) {
        return {
          ok: false,
          error: "Ya existe un colaborador archivado con ese email. Reactivalo en la vista Archivados para conservar su historial.",
        };
      }
    }

    const created = await createEmployee(g.value.salonId, employee, service_ids, category_ids);
    revalidatePath("/employees");

    // Auto-generate invite when email + role are provided
    if (email && roleId) {
      const token = randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const supabase = await createSupabaseServerClient();
      const { error: invErr } = await supabase.from("employee_invitations").insert({
        employee_id: created.id,
        salon_id: g.value.salonId,
        email,
        role_id: roleId,
        token,
        expires_at: expiresAt,
      });
      if (!invErr) {
        return { ok: true, value: { id: created.id, inviteToken: token, inviteExpiresAt: expiresAt } };
      }
    }

    return { ok: true, value: { id: created.id } };
  } catch (err) {
    console.error("[employees]", err);
    return { ok: false, error: "Error al crear el colaborador." };
  }
}

export async function findArchivedEmployeeByEmailAction(email: string): Promise<ArchivedEmployeeMatch | null> {
  const g = await guard();
  if (!g.ok) return null;

  const trimmed = email.trim();
  if (!trimmed) return null;

  const employee = await findEmployeeByEmail(trimmed, g.value.salonId);
  if (!employee || employee.is_active) return null;

  return {
    id: employee.id,
    name: `${employee.first_name} ${employee.last_name}`.trim(),
    email: employee.email,
  };
}

export async function reactivateEmployeeAction(employeeId: string): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  const employee = await findEmployeeById(employeeId, g.value.salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };

  try {
    await updateEmployee(employeeId, g.value.salonId, { is_active: true });
    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/appointments/new");
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[employees]", err);
    return { ok: false, error: "No se pudo reactivar el colaborador." };
  }
}

export async function updateEmployeeAction(
  employeeId: string,
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  const parsed = CreateEmployeeSchema.partial().safeParse({
    first_name: formData.get("first_name") ?? undefined,
    last_name: formData.get("last_name") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    email: formData.get("email") ?? undefined,
    specialty: formData.get("specialty") ?? undefined,
    commission_percentage: formData.get("commission_percentage")
      ? Number(formData.get("commission_percentage"))
      : undefined,
    service_ids: formData.getAll("service_ids").map(String),
    category_ids: formData.getAll("category_ids").map(String),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const currentEmployee = await findEmployeeById(employeeId, g.value.salonId);
    if (!currentEmployee) return { ok: false, error: "Colaborador no encontrado." };

    const { service_ids, category_ids, ...fields } = parsed.data;
    const updateFields: typeof fields & { profile_id?: null } = { ...fields };
    const nextEmail = typeof fields.email === "string" ? fields.email.trim() : currentEmployee.email?.trim() ?? "";
    const currentEmail = currentEmployee.email?.trim() ?? "";
    const emailChanged = nextEmail.toLowerCase() !== currentEmail.toLowerCase();
    const admin = createSupabaseAdminClient();
    let roleForNewInvite: string | null = null;

    if (emailChanged && currentEmployee.profile_id) {
      if (!nextEmail) {
        return {
          ok: false,
          error: "No puedes dejar sin email a un colaborador que ya tiene acceso al sistema.",
        };
      }

      const revoked = await revokeEmployeeAuthAccess(employeeId, g.value.salonId, currentEmployee.profile_id);
      if (!revoked.ok) return revoked;
      roleForNewInvite = revoked.value.roleId;
      updateFields.profile_id = null;
    }

    await updateEmployee(employeeId, g.value.salonId, updateFields);
    await updateEmployeeServices(employeeId, g.value.salonId, service_ids ?? []);
    await updateEmployeeCategories(employeeId, g.value.salonId, category_ids ?? []);

    if (emailChanged && !currentEmployee.profile_id) {
      const { data: latestInvite } = await admin
        .from("employee_invitations")
        .select("role_id")
        .eq("employee_id", employeeId)
        .eq("salon_id", g.value.salonId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (nextEmail) {
        const invite = await replacePendingEmployeeInvitation({
          employeeId,
          salonId: g.value.salonId,
          email: nextEmail,
          roleId: latestInvite?.role_id ?? null,
        });
        if (!invite.ok) return invite;
      }
    }

    if (emailChanged && currentEmployee.profile_id && nextEmail) {
      const invite = await replacePendingEmployeeInvitation({
        employeeId,
        salonId: g.value.salonId,
        email: nextEmail,
        roleId: roleForNewInvite,
      });
      if (!invite.ok) return invite;
    }

    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[employees]", err);
    return { ok: false, error: "Error al actualizar el colaborador." };
  }
}

export async function changeEmployeeRoleAction(
  profileId: string,
  roleId: string | null
): Promise<Result<void>> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar colaboradores." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role_id: roleId || null })
    .eq("id", profileId)
    .eq("salon_id", profile.salon_id);
  if (error) return { ok: false, error: "Error al cambiar el rol." };
  revalidatePath("/employees");
  return { ok: true, value: undefined };
}

export async function resetEmployeeAccessAction(
  employeeId: string,
  roleId: string | null
): Promise<Result<{ token: string; expiresAt: string }>> {
  const g = await guard();
  if (!g.ok) return g;

  const employee = await findEmployeeById(employeeId, g.value.salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };
  const email = employee.email?.trim();
  if (!email) return { ok: false, error: "Este colaborador no tiene email registrado." };

  let inviteRoleId = roleId || null;
  if (employee.profile_id) {
    const revoked = await revokeEmployeeAuthAccess(employeeId, g.value.salonId, employee.profile_id);
    if (!revoked.ok) return revoked;
    inviteRoleId = inviteRoleId || revoked.value.roleId;
  }

  const invite = await replacePendingEmployeeInvitation({
    employeeId,
    salonId: g.value.salonId,
    email,
    roleId: inviteRoleId,
  });
  if (!invite.ok) return invite;

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  return invite;
}

export async function addWorkScheduleAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  const parsed = WorkScheduleSchema.safeParse({
    employee_id: formData.get("employee_id"),
    day_of_week: Number(formData.get("day_of_week")),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.end_time <= parsed.data.start_time) {
    return { ok: false, error: "La hora de fin debe ser mayor que la de inicio." };
  }

  try {
    await upsertWorkSchedule(g.value.salonId, parsed.data);
    revalidatePath(`/employees/${parsed.data.employee_id}`);
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[employees]", err);
    return { ok: false, error: "Error al guardar el horario (¿ya existe ese bloque?)." };
  }
}

export async function deleteWorkScheduleAction(
  scheduleId: string,
  employeeId: string
): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  try {
    await deleteWorkSchedule(scheduleId, g.value.salonId);
    revalidatePath(`/employees/${employeeId}`);
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[employees]", err);
    return { ok: false, error: "Error al eliminar el horario." };
  }
}

export async function generateEmployeeInviteAction(
  employeeId: string,
  roleId: string | null
): Promise<Result<{ token: string; expiresAt: string }>> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar colaboradores." };
  }

  const employee = await findEmployeeById(employeeId, profile.salon_id);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };
  if (!employee.email?.trim()) return { ok: false, error: "Este colaborador no tiene email registrado." };
  if (employee.profile_id) return { ok: false, error: "Este colaborador ya tiene acceso al sistema." };

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Replace any existing pending invitation for this employee
  await admin
    .from("employee_invitations")
    .delete()
    .eq("employee_id", employeeId)
    .is("accepted_at", null);

  const { error } = await supabase.from("employee_invitations").insert({
    employee_id: employeeId,
    salon_id: profile.salon_id,
    email: employee.email.trim(),
    role_id: roleId || null,
    token,
    expires_at: expiresAt,
  });

  if (error) return { ok: false, error: "Error al generar el enlace de acceso." };

  revalidatePath(`/employees/${employeeId}`);
  return { ok: true, value: { token, expiresAt } };
}

export async function deleteEmployeeAction(
  employeeId: string
): Promise<Result<{ outcome: "deleted" | "archived"; message: string }>> {
  const g = await guard();
  if (!g.ok) return g;

  const employee = await findEmployeeById(employeeId, g.value.salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };

  const admin = createSupabaseAdminClient();

  if (employee.profile_id) {
    const { data: linkedProfile, error: profileError } = await admin
      .from("profiles")
      .select("is_owner")
      .eq("id", employee.profile_id)
      .maybeSingle();

    if (profileError) {
      console.error("[employees]", profileError);
      return { ok: false, error: "Error al verificar el acceso del colaborador." };
    }
    if (linkedProfile?.is_owner) {
      return { ok: false, error: "No se puede eliminar un owner desde colaboradores." };
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(employee.profile_id);
    if (authDeleteError) {
      console.error("[employees]", authDeleteError);
      return { ok: false, error: "No se pudo revocar el acceso del colaborador." };
    }
  }

  const { error: inviteCleanupError } = await admin
    .from("employee_invitations")
    .delete()
    .eq("employee_id", employeeId)
    .eq("salon_id", g.value.salonId);

  if (inviteCleanupError) {
    console.error("[employees]", inviteCleanupError);
    return { ok: false, error: "No se pudo limpiar la invitación del colaborador." };
  }

  try {
    await updateEmployee(employeeId, g.value.salonId, {
      is_active: false,
      profile_id: null,
    });
    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/appointments/new");
    return {
      ok: true,
      value: {
        outcome: "archived",
        message: "Colaborador archivado conservando su información para trazabilidad.",
      },
    };
  } catch (archiveErr) {
    console.error("[employees]", archiveErr);
    return { ok: false, error: "No se pudo archivar el colaborador." };
  }
}
