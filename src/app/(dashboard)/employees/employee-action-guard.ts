import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { PERMISSIONS, type ActionContext } from "@/features/access";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import type { EmployeeAdmissionInput } from "@/features/employees/use-cases/employee-admission";
import type { RoleGate } from "@/features/employees/use-cases/employee-role-commands";
import { err, ok, type Result } from "@/infra/result";
import { parseUuid } from "@/infra/validation/route-id";

// Politica comun de las acciones de colaboradores: permiso por clave y limite de
// peticiones por usuario. Cada accion la extiende con defineAction; ninguna la
// reimplementa. Vive aparte para que cada modulo actions-*.ts quede bajo el limite de lineas.

export const EMPLOYEE_GUARD = {
  permission: {
    key: PERMISSIONS.EMPLOYEES_MANAGE,
    deniedMessage: "No tienes permiso para gestionar colaboradores.",
  },
  // Estas acciones crean cuentas Auth y enlaces de acceso: un límite por
  // usuario evita generacion masiva automatizada.
  rateLimit: { scope: "employees", options: RATE_LIMIT_POLICIES.restricted },
};

export function activeLimitCheck(salonId: string): () => ReturnType<typeof checkPlanLimit> {
  return () => checkPlanLimit({ salonId, metricKey: "employees.active" });
}

export function loginLimitCheck(salonId: string): () => ReturnType<typeof checkPlanLimit> {
  return () => checkPlanLimit({ salonId, metricKey: "employees.login_users" });
}

/** Chequeos de admision de un alta: modulo, cupo de activos y cupo de login. */
export function admissionChecks(salonId: string): EmployeeAdmissionInput["checks"] {
  return {
    checkModuleAccess: () => checkPlanModuleAccess({ salonId, moduleKey: "employees" }),
    checkActiveLimit: activeLimitCheck(salonId),
    checkLoginLimit: loginLimitCheck(salonId),
  };
}

const INVALID_ID = "Identificador inválido.";

/** Identificadores de la accion: un null (rol opcional) es valido, un UUID mal formado no. */
export function checkIds<T>(value: T, ids: (string | null)[]): Result<T> {
  return ids.every((id) => id === null || parseUuid(id) !== null) ? ok(value) : err(INVALID_ID);
}

/** Puerta de roles de una accion: el salón de la sesion y si el plan incluye roles (resuelto por el composition root). */
export function roleGateOf(session: ActionContext): RoleGate {
  return { salonId: session.salonId, rolesEnabled: session.rolesEnabled };
}
