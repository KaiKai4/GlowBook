import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/features/access";
import { createEmployee } from "@/features/employees";
import { ok } from "@/infra/result";
import { formDataOf, SALON_ID, USER_ID } from "@/test/action-fixtures";
import { createEmployeeAction } from "./actions-profile";

// Conducta del alta en el borde: un formulario invalido no llega al caso de uso
// (y por tanto no consulta el plan); un formulario valido si llega con sus datos.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActionContext: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  isEffectiveSalonModuleEnabled: vi.fn(),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("@/features/employees", () => ({
  archiveEmployee: vi.fn(),
  findArchivedEmployeeByEmail: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  reactivateEmployeeWithLimitCheck: vi.fn(),
}));

const { requireActionContext } = await import("@/app/_composition/request-context");
const { assertActionRateLimit } = await import("@/infra/security/rate-limit");
const { checkPlanLimit, checkPlanModuleAccess, isEffectiveSalonModuleEnabled } = await import("@/features/billing");

const KEY = "00000000-0000-4000-8000-0000000000f1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireActionContext).mockResolvedValue({
    userId: USER_ID,
    salonId: SALON_ID,
    permissions: [PERMISSIONS.EMPLOYEES_MANAGE],
    requestId: "req-1",
    rolesEnabled: false,
    disabledFeatures: [],
  } as never);
  vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
  vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
  vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
  vi.mocked(createEmployee).mockResolvedValue(ok({ id: "emp-1" } as never));
});

describe("createEmployeeAction: orden del borde", () => {
  it("un formulario sin clave de idempotencia falla antes del caso de uso y no consulta el plan", async () => {
    const result = await createEmployeeAction(null, formDataOf({ first_name: "Ana", last_name: "Pérez" }));

    expect(result.ok).toBe(false);
    expect(createEmployee).not.toHaveBeenCalled();
    expect(checkPlanLimit).not.toHaveBeenCalled();
    expect(checkPlanModuleAccess).not.toHaveBeenCalled();
  });

  it("un formulario sin nombre devuelve el error de validacion, no un error de plan", async () => {
    const result = await createEmployeeAction(null, formDataOf({ idempotency_key: KEY, first_name: "" }));

    expect(result.ok).toBe(false);
    expect(createEmployee).not.toHaveBeenCalled();
  });

  it("un formulario valido llega al caso de uso con la clave y los datos ya validados", async () => {
    await createEmployeeAction(null, formDataOf({ idempotency_key: KEY, first_name: "Ana", last_name: "Pérez" }));

    expect(createEmployee).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createEmployee).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        salonId: SALON_ID,
        idempotencyKey: KEY,
        requestedRoleId: null,
        data: expect.objectContaining({ first_name: "Ana", last_name: "Pérez" }),
      })
    );
  });
});
