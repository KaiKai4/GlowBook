import {
  createEmployee as insertEmployee,
  findEmployeeById,
  findEmployeeByEmail,
  updateEmployee,
  updateEmployeeCategories,
  updateEmployeeServices,
} from "@/features/employees/data/employees.repo";
import {
  generateEmployeeInvitation,
  replacePendingEmployeeInvitation,
  revokeEmployeeAuthAccess,
} from "./employee-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/features/employees/schemas";
import type { Result } from "@/lib/result";

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

export async function findArchivedEmployeeByEmail(
  salonId: string,
  email: string
): Promise<ArchivedEmployeeMatch | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const employee = await findEmployeeByEmail(trimmed, salonId);
  if (!employee || employee.is_active) return null;

  return {
    id: employee.id,
    name: `${employee.first_name} ${employee.last_name}`.trim(),
    email: employee.email,
  };
}

export async function createEmployeeProfile(
  salonId: string,
  input: CreateEmployeeInput,
  roleId: string | null
): Promise<Result<CreateEmployeeResult>> {
  try {
    const { service_ids, category_ids, ...employee } = input;
    const email = employee.email?.trim();
    if (email) {
      const archived = await findEmployeeByEmail(email, salonId);
      if (archived && !archived.is_active) {
        return {
          ok: false,
          error: "Ya existe un colaborador archivado con ese email. Reactivalo en la vista Archivados para conservar su historial.",
        };
      }
    }

    const created = await insertEmployee(salonId, employee, service_ids, category_ids);

    if (email && roleId) {
      const invite = await generateEmployeeInvitation({
        employeeId: created.id,
        salonId,
        email,
        roleId,
      });

      if (invite.ok) {
        return {
          ok: true,
          value: {
            id: created.id,
            inviteToken: invite.value.token,
            inviteExpiresAt: invite.value.expiresAt,
          },
        };
      }
    }

    return { ok: true, value: { id: created.id } };
  } catch (err) {
    console.error("[employees:profile]", err);
    return { ok: false, error: "Error al crear el colaborador." };
  }
}

export async function updateEmployeeProfile(
  employeeId: string,
  salonId: string,
  input: UpdateEmployeeInput
): Promise<Result<void>> {
  try {
    const currentEmployee = await findEmployeeById(employeeId, salonId);
    if (!currentEmployee) return { ok: false, error: "Colaborador no encontrado." };

    const { service_ids, category_ids, ...fields } = input;
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

      const revoked = await revokeEmployeeAuthAccess(employeeId, salonId, currentEmployee.profile_id);
      if (!revoked.ok) return revoked;
      roleForNewInvite = revoked.value.roleId;
      updateFields.profile_id = null;
    }

    await updateEmployee(employeeId, salonId, updateFields);
    await updateEmployeeServices(employeeId, salonId, service_ids ?? []);
    await updateEmployeeCategories(employeeId, salonId, category_ids ?? []);

    if (emailChanged && !currentEmployee.profile_id) {
      const { data: latestInvite } = await admin
        .from("employee_invitations")
        .select("role_id")
        .eq("employee_id", employeeId)
        .eq("salon_id", salonId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (nextEmail) {
        const invite = await replacePendingEmployeeInvitation({
          employeeId,
          salonId,
          email: nextEmail,
          roleId: latestInvite?.role_id ?? null,
        });
        if (!invite.ok) return invite;
      }
    }

    if (emailChanged && currentEmployee.profile_id && nextEmail) {
      const invite = await replacePendingEmployeeInvitation({
        employeeId,
        salonId,
        email: nextEmail,
        roleId: roleForNewInvite,
      });
      if (!invite.ok) return invite;
    }

    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[employees:profile]", err);
    return { ok: false, error: "Error al actualizar el colaborador." };
  }
}
