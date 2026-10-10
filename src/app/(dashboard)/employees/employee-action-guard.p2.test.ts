import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit, checkPlanModuleAccess, isEffectiveSalonModuleEnabled } from "@/features/billing";
import { PERMISSIONS } from "@/features/access";
import { ok } from "@/infra/result";
import { buildProfile, SALON_ID } from "@/test/action-fixtures";
import { admissionChecks, EMPLOYEE_GUARD, rolesEnabledOf } from "./employee-action-guard";

vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  isEffectiveSalonModuleEnabled: vi.fn(),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));

const manager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });

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

  it("consulta el modulo de roles del perfil y devuelve su valor", async () => {
    expect(await rolesEnabledOf(manager)).toBe(true);
    expect(isEffectiveSalonModuleEnabled).toHaveBeenCalledWith(manager, "roles");

    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);
    expect(await rolesEnabledOf(manager)).toBe(false);
  });

  it("construye los chequeos de admision con el salon de la sesion", async () => {
    const checks = admissionChecks(SALON_ID);

    await checks.checkModuleAccess();
    await checks.checkActiveLimit();
    await checks.checkLoginLimit();

    expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON_ID, moduleKey: "employees" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "employees.active" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "employees.login_users" });
  });
});
