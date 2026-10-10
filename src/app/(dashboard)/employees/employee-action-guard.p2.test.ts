import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit, checkPlanModuleAccess, isEffectiveSalonModuleEnabled } from "@/features/billing";
import { PERMISSIONS } from "@/features/access";
import { ok } from "@/infra/result";
import { SALON_ID } from "@/test/action-fixtures";
import { admissionChecks, EMPLOYEE_GUARD, roleGateOf } from "./employee-action-guard";

vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  isEffectiveSalonModuleEnabled: vi.fn(),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));


describe("politica de acciones de colaboradores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
  });

  it("exige la clave de permiso de colaboradores con su mensaje de denegacion", () => {
    expect(EMPLOYEE_GUARD.permission).toEqual({
      key: PERMISSIONS.EMPLOYEES_MANAGE,
      deniedMessage: "No tienes permiso para gestionar colaboradores.",
    });
  });

  it("limita por usuario con 30 peticiones por minuto en el ámbito employees", () => {
    expect(EMPLOYEE_GUARD.rateLimit).toEqual({ scope: "employees", options: { max: 30, windowMs: 60_000 } });
  });

  it("la puerta de roles usa el salón y el flag ya resuelto por el composition root", () => {
    const context = { userId: "user-1", salonId: SALON_ID, permissions: [], requestId: "req-1" };

    expect(roleGateOf({ ...context, rolesEnabled: true })).toEqual({ salonId: SALON_ID, rolesEnabled: true });
    expect(roleGateOf({ ...context, rolesEnabled: false })).toEqual({ salonId: SALON_ID, rolesEnabled: false });
  });

  it("construye los chequeos de admision con el salón de la sesión", async () => {
    const checks = admissionChecks(SALON_ID);

    await checks.checkModuleAccess();
    await checks.checkActiveLimit();
    await checks.checkLoginLimit();

    expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON_ID, moduleKey: "employees" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "employees.active" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "employees.login_users" });
  });
});
