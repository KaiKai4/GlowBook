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
} from "@/features/employees/data/employees.repo";
import { CreateEmployeeSchema, WorkScheduleSchema } from "@/features/employees/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    const created = await createEmployee(g.value.salonId, employee, service_ids, category_ids);
    revalidatePath("/employees");

    // Auto-generate invite when email + role are provided
    const email = employee.email?.trim();
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
  } catch {
    return { ok: false, error: "Error al crear el colaborador." };
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
    const { service_ids, category_ids, ...fields } = parsed.data;
    await updateEmployee(employeeId, g.value.salonId, fields);
    await updateEmployeeServices(employeeId, g.value.salonId, service_ids ?? []);
    await updateEmployeeCategories(employeeId, g.value.salonId, category_ids ?? []);
    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    return { ok: true, value: undefined };
  } catch {
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
  } catch {
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
  } catch {
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

  // Replace any existing pending invitation for this employee
  await supabase
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
