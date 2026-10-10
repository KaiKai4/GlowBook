import { err, ok, type Result } from "@/infra/result";

// Admision de un alta de colaborador: comprueba el plan antes de tocar datos.
// Los chequeos del plan llegan por parametro (el caso de uso no importa el modulo
// de billing): la accion los construye con el salón de la sesion.

interface EmployeeAdmissionChecks {
  /** Acceso al modulo de colaboradores en el plan vigente. */
  checkModuleAccess: () => Promise<Result<void>>;
  /** Cupo de colaboradores activos. */
  checkActiveLimit: () => Promise<Result<void>>;
  /** Cupo de usuarios con login. Solo se consulta si el alta lleva rol. */
  checkLoginLimit: () => Promise<Result<void>>;
}

export interface EmployeeAdmissionInput {
  /** El salon tiene roles habilitados en su plan. */
  rolesEnabled: boolean;
  /** Rol pedido en el formulario (puede venir vacio). */
  requestedRoleId: string | null;
  checks: EmployeeAdmissionChecks;
}

/**
 * Devuelve el rol efectivo del alta: solo existe si el salón tiene roles
 * habilitados. Con rol, el alta emite una invitación de acceso propio y consume
 * tambien el cupo de usuarios con login.
 */
export async function admitNewEmployee(
  input: EmployeeAdmissionInput
): Promise<Result<{ roleId: string | null }>> {
  const moduleAccess = await input.checks.checkModuleAccess();
  if (!moduleAccess.ok) return err(moduleAccess.error);

  const activeLimit = await input.checks.checkActiveLimit();
  if (!activeLimit.ok) return err(activeLimit.error);

  const roleId = input.rolesEnabled ? input.requestedRoleId?.trim() || null : null;
  if (roleId) {
    const loginLimit = await input.checks.checkLoginLimit();
    if (!loginLimit.ok) return err(loginLimit.error);
  }

  return ok({ roleId });
}
