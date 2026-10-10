import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { PERMISSIONS } from "@/features/access";
import {
  checkPlanLimit,
  checkPlanModuleAccess,
  isEffectiveSalonModuleEnabled,
  salonModuleScopeFromProfile,
} from "@/features/billing";
import type { EmployeeAdmissionInput } from "@/features/employees/use-cases/employee-admission";
import type { ProfileWithRole } from "@/types/app.types";

// Politica comun de las acciones de colaboradores: permiso por clave y limite de
// peticiones por usuario. Cada accion la extiende con defineAction; ninguna la
// reimplementa. Vive aparte para mantener actions.ts bajo el limite de lineas.

export const EMPLOYEE_GUARD = {
  permission: {
    key: PERMISSIONS.EMPLOYEES_MANAGE,
    deniedMessage: "No tienes permiso para gestionar colaboradores.",
  },
  // Estas acciones crean cuentas Auth y enlaces de acceso: un límite por
  // usuario evita generacion masiva automatizada.
  rateLimit: { scope: "employees", options: RATE_LIMIT_POLICIES.restricted },
};

/** Roles habilitados en el plan del salon para el perfil de la sesion. */
export function rolesEnabledOf(profile: ProfileWithRole): Promise<boolean> {
  return isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "roles");
}

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
