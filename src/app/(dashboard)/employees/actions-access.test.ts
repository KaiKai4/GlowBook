import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { changeEmployeeRole } from "@/features/employees/use-cases/employee-role";
import { resetEmployeeAccess } from "@/features/employees/use-cases/employee-revocation";
import { err, ok } from "@/infra/result";
import { buildProfile, rolesDisabled, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import {
  changeEmployeeRoleAction,
  resetEmployeeAccessAction,
} from "./actions-access";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
  const requireActiveProfile = vi.fn();
  return {
    requireActiveProfile,
    requireActionContext: vi.fn(async () => contextFromProfile(await requireActiveProfile())),
  };
});
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-role", () => ({
  changeEmployeeRole: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-revocation", () => ({
  resetEmployeeAccess: vi.fn(),
}));

const employeesManager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });
const rolesDisabledError = "Los roles estan deshabilitados para este salon.";

describe("employees actions (roles de acceso)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(employeesManager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  describe("roles de acceso", () => {
    it("cambiar rol y resetear acceso se bloquean si los roles están deshabilitados", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(rolesDisabled(employeesManager));

      expect(await changeEmployeeRoleAction(RECORD_ID, RECORD_ID)).toEqual({
        ok: false,
        error: rolesDisabledError,
      });
      expect(await resetEmployeeAccessAction(RECORD_ID, RECORD_ID)).toEqual({
        ok: false,
        error: rolesDisabledError,
      });
      expect(changeEmployeeRole).not.toHaveBeenCalled();
      expect(resetEmployeeAccess).not.toHaveBeenCalled();
    });

    it("cambia el rol del colaborador y revalida solo si tiene éxito", async () => {
      vi.mocked(changeEmployeeRole).mockResolvedValue(ok(undefined));

      expect(await changeEmployeeRoleAction(RECORD_ID, null)).toEqual({ ok: true, value: undefined });
      expect(changeEmployeeRole).toHaveBeenCalledWith(SALON_ID, RECORD_ID, null);
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
    });

    it("el reseteo de acceso devuelve el enlace y revalida el listado y la ficha", async () => {
      const invite = { ok: true as const, value: { token: "t-1", expiresAt: "2026-10-10T00:00:00.000Z" } };
      vi.mocked(resetEmployeeAccess).mockResolvedValue(invite);

      expect(await resetEmployeeAccessAction(RECORD_ID, RECORD_ID)).toEqual(invite);
      expect(resetEmployeeAccess).toHaveBeenCalledWith({
        employeeId: RECORD_ID,
        salonId: SALON_ID,
        roleId: RECORD_ID,
      });
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${RECORD_ID}`);
    });

    it("el reseteo fallido no revalida", async () => {
      vi.mocked(resetEmployeeAccess).mockResolvedValue(err("El colaborador no tiene email."));

      expect(await resetEmployeeAccessAction(RECORD_ID, null)).toEqual({
        ok: false,
        error: "El colaborador no tiene email.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
