import { captureError } from "@/infra/observability";
import { findEmployeeById } from "@/features/employees/data/employees-read.repo";
import { updateEmployee } from "@/features/employees/data/employees-write.repo";
import { clearEmployeeInvitations } from "./employee-invitation-issue";
import { checkEmployeeAccessRevocable, deleteEmployeeAuthAccount } from "./employee-revocation";
import { OLD_ACCOUNT_NOT_DELETED_WARNING } from "./employee-access-warnings";
import type { Result } from "@/infra/result";

/** Dependencias de reactivar y archivar. Producción usa las funciones reales; los tests inyectan fakes. */
export interface EmployeeLifecycleDeps {
  findEmployee: (id: string, salonId: string) => Promise<{ profile_id: string | null } | null>;
  updateEmployee: (
    id: string,
    salonId: string,
    input: Parameters<typeof updateEmployee>[2]
  ) => Promise<unknown>;
  clearInvitations: typeof clearEmployeeInvitations;
  checkAccessRevocable: typeof checkEmployeeAccessRevocable;
  deleteAuthAccount: typeof deleteEmployeeAuthAccount;
}

const defaultEmployeeLifecycleDeps: EmployeeLifecycleDeps = {
  findEmployee: findEmployeeById,
  updateEmployee,
  clearInvitations: clearEmployeeInvitations,
  checkAccessRevocable: checkEmployeeAccessRevocable,
  deleteAuthAccount: deleteEmployeeAuthAccount,
};

export async function reactivateEmployee(
  employeeId: string,
  salonId: string,
  deps: EmployeeLifecycleDeps = defaultEmployeeLifecycleDeps
): Promise<Result<void>> {
  const employee = await deps.findEmployee(employeeId, salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };

  try {
    await deps.updateEmployee(employeeId, salonId, { is_active: true });
    return { ok: true, value: undefined };
  } catch (err) {
    captureError(err, { module: "employees", action: "lifecycle" });
    return { ok: false, error: "No se pudo reactivar el colaborador." };
  }
}

export async function archiveEmployee(
  employeeId: string,
  salonId: string,
  deps: EmployeeLifecycleDeps = defaultEmployeeLifecycleDeps
): Promise<Result<{ outcome: "archived"; message: string }>> {
  const employee = await deps.findEmployee(employeeId, salonId);
  if (!employee) return { ok: false, error: "Colaborador no encontrado." };

  // 1) Validaciones previas (owner, perfil existente): no escriben nada.
  if (employee.profile_id) {
    const access = await deps.checkAccessRevocable(employee.profile_id, salonId);
    if (!access.ok) return access;
  }

  // 2) Escritura en BD: invitaciones y desactivacion. Si falla, la cuenta de Auth sigue intacta.
  try {
    const cleared = await deps.clearInvitations(employeeId, salonId);
    if (!cleared.ok) return cleared;

    await deps.updateEmployee(employeeId, salonId, {
      is_active: false,
      profile_id: null,
    });
  } catch (err) {
    captureError(err, { module: "employees", action: "lifecycle" });
    return { ok: false, error: "No se pudo archivar el colaborador." };
  }

  // 3) Efecto en Auth. El archivado ya esta confirmado: si falla, se avisa en vez de fallar.
  const warnings: string[] = [];
  if (employee.profile_id) {
    const deleted = await deps.deleteAuthAccount(employee.profile_id);
    if (!deleted.ok) warnings.push(OLD_ACCOUNT_NOT_DELETED_WARNING);
  }

  return {
    ok: true,
    value: {
      outcome: "archived",
      message: "Colaborador archivado conservando su información para trazabilidad.",
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
