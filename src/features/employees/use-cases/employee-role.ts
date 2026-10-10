import { captureError } from "@/infra/observability";
import {
  findAssignableEmployeeRole,
  updateEmployeeProfileRole,
} from "@/features/employees/data/employee-access.repo";
import type { Result } from "@/infra/result";

/** Dependencias del cambio de rol. Producción usa las funciones reales; los tests inyectan fakes. */
export interface EmployeeRoleDeps {
  findAssignableRole: typeof findAssignableEmployeeRole;
  updateProfileRole: typeof updateEmployeeProfileRole;
}

const defaultEmployeeRoleDeps: EmployeeRoleDeps = {
  findAssignableRole: findAssignableEmployeeRole,
  updateProfileRole: updateEmployeeProfileRole,
};

/** Valida que el rol pedido exista en el salón y no sea de sistema. Null (sin rol) es valido. */
export async function validateAssignableRoleId(
  salonId: string,
  roleId: string | null,
  deps: Pick<EmployeeRoleDeps, "findAssignableRole"> = defaultEmployeeRoleDeps
): Promise<Result<string | null>> {
  if (!roleId) return { ok: true, value: null };

  const { data, error } = await deps.findAssignableRole(salonId, roleId);

  if (error) {
    captureError(error, { module: "employees", action: "access" });
    return { ok: false, error: "No se pudo verificar el rol del colaborador." };
  }

  if (!data) {
    return { ok: false, error: "El rol seleccionado no es válido para este salón." };
  }

  return { ok: true, value: data.id };
}

/** Cambio de rol de un colaborador con cuenta vinculada. */
export async function changeEmployeeRole(
  salonId: string,
  profileId: string,
  roleId: string | null,
  deps: EmployeeRoleDeps = defaultEmployeeRoleDeps
): Promise<Result<void>> {
  const assignableRole = await validateAssignableRoleId(salonId, roleId, deps);
  if (!assignableRole.ok) return assignableRole;

  const { error } = await deps.updateProfileRole(
    profileId,
    salonId,
    assignableRole.value
  );

  if (error) {
    captureError(error, { module: "employees", action: "access" });
    return { ok: false, error: "Error al cambiar el rol." };
  }

  return { ok: true, value: undefined };
}
