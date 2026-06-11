"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { CreateEmployeeSchema, WorkScheduleSchema } from "@/features/employees/schemas";
import {
  changeEmployeeRole,
  createEmployeeInviteForExistingEmployee,
  resetEmployeeAccess,
} from "@/features/employees/use-cases/employee-access";
import {
  archiveEmployee,
  reactivateEmployee,
} from "@/features/employees/use-cases/employee-lifecycle";
import {
  addEmployeeWorkSchedule,
  removeEmployeeWorkSchedule,
} from "@/features/employees/use-cases/employee-schedule";
import {
  createEmployeeProfile,
  findArchivedEmployeeByEmail,
  updateEmployeeProfile,
  type ArchivedEmployeeMatch,
  type CreateEmployeeResult,
} from "@/features/employees/use-cases/employee-profile";
import {
  checkPlanLimit,
  checkPlanModuleAccess,
  isEffectiveSalonModuleEnabled,
} from "@/features/billing/use-cases/commercial-plans";
import type { Result } from "@/lib/result";

async function guard(): Promise<Result<{ salonId: string; rolesEnabled: boolean }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar colaboradores." };
  }

  return {
    ok: true,
    value: {
      salonId: profile.salon_id,
      rolesEnabled: await isEffectiveSalonModuleEnabled(profile, "roles"),
    },
  };
}

export async function createEmployeeAction(
  _prev: Result<CreateEmployeeResult> | null,
  formData: FormData
): Promise<Result<CreateEmployeeResult>> {
  const g = await guard();
  if (!g.ok) return g;
  const moduleAccess = await checkPlanModuleAccess({ salonId: g.value.salonId, moduleKey: "employees" });
  if (!moduleAccess.ok) return { ok: false, error: moduleAccess.error };
  const limit = await checkPlanLimit({ salonId: g.value.salonId, metricKey: "employees.active" });
  if (!limit.ok) return { ok: false, error: limit.error };

  const roleId = g.value.rolesEnabled
    ? (formData.get("role_id") as string)?.trim() || null
    : null;

  // Con rol asignado se emite una invitacion de acceso propio: tambien
  // consume el cupo de usuarios con login del plan.
  if (roleId) {
    const loginLimit = await checkPlanLimit({ salonId: g.value.salonId, metricKey: "employees.login_users" });
    if (!loginLimit.ok) return { ok: false, error: loginLimit.error };
  }

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

  const result = await createEmployeeProfile(g.value.salonId, parsed.data, roleId);
  if (result.ok) {
    revalidatePath("/employees");
  }
  return result;
}

export async function findArchivedEmployeeByEmailAction(email: string): Promise<ArchivedEmployeeMatch | null> {
  const g = await guard();
  if (!g.ok) return null;

  return findArchivedEmployeeByEmail(g.value.salonId, email);
}

export async function reactivateEmployeeAction(employeeId: string): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;
  const limit = await checkPlanLimit({ salonId: g.value.salonId, metricKey: "employees.active" });
  if (!limit.ok) return { ok: false, error: limit.error };

  const result = await reactivateEmployee(employeeId, g.value.salonId);
  if (result.ok) {
    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/appointments/new");
  }
  return result;
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

  const result = await updateEmployeeProfile(employeeId, g.value.salonId, parsed.data);
  if (result.ok) {
    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
  }
  return result;
}

export async function changeEmployeeRoleAction(
  profileId: string,
  roleId: string | null
): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;
  if (!g.value.rolesEnabled) {
    return { ok: false, error: "Los roles estan deshabilitados para este salon." };
  }

  const result = await changeEmployeeRole(g.value.salonId, profileId, roleId);
  if (result.ok) {
    revalidatePath("/employees");
  }
  return result;
}

export async function resetEmployeeAccessAction(
  employeeId: string,
  roleId: string | null
): Promise<Result<{ token: string; expiresAt: string }>> {
  const g = await guard();
  if (!g.ok) return g;
  if (!g.value.rolesEnabled) {
    return { ok: false, error: "Los roles estan deshabilitados para este salon." };
  }

  const invite = await resetEmployeeAccess({
    employeeId,
    salonId: g.value.salonId,
    roleId: roleId || null,
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
  const result = await addEmployeeWorkSchedule(g.value.salonId, parsed.data);
  if (result.ok) {
    revalidatePath(`/employees/${parsed.data.employee_id}`);
  }
  return result;
}

export async function deleteWorkScheduleAction(
  scheduleId: string,
  employeeId: string
): Promise<Result<void>> {
  const g = await guard();
  if (!g.ok) return g;

  const result = await removeEmployeeWorkSchedule(g.value.salonId, scheduleId);
  if (result.ok) {
    revalidatePath(`/employees/${employeeId}`);
  }
  return result;
}

export async function generateEmployeeInviteAction(
  employeeId: string,
  roleId: string | null
): Promise<Result<{ token: string; expiresAt: string }>> {
  const g = await guard();
  if (!g.ok) return g;
  if (!g.value.rolesEnabled) {
    return { ok: false, error: "Los roles estan deshabilitados para este salon." };
  }
  // Un acceso propio nuevo consume el cupo de usuarios con login del plan.
  const limit = await checkPlanLimit({ salonId: g.value.salonId, metricKey: "employees.login_users" });
  if (!limit.ok) return { ok: false, error: limit.error };

  const invite = await createEmployeeInviteForExistingEmployee({
    employeeId,
    salonId: g.value.salonId,
    roleId: roleId || null,
  });
  if (!invite.ok) return invite;

  revalidatePath(`/employees/${employeeId}`);
  return invite;
}

export async function deleteEmployeeAction(
  employeeId: string
): Promise<Result<{ outcome: "deleted" | "archived"; message: string }>> {
  const g = await guard();
  if (!g.ok) return g;

  const result = await archiveEmployee(employeeId, g.value.salonId);
  if (result.ok) {
    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/appointments/new");
  }
  return result;
}
