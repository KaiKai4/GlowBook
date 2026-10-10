import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import type { CreateCustomerInput } from "@/features/customers/schemas";
import { err, ok } from "@/infra/result";
import { createCustomerProfile } from "./customer-profile";
import { createCustomerGuarded } from "./create-customer-guarded";

vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("./customer-profile", () => ({ createCustomerProfile: vi.fn() }));

const SALON_ID = "00000000-0000-4000-8000-0000000000a1";
const input = { first_name: "Ana" } as CreateCustomerInput;

describe("createCustomerGuarded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(createCustomerProfile).mockResolvedValue(ok("customer-id"));
  });

  it("consulta el módulo de clientes y el cupo de clientes activos del salón", async () => {
    await createCustomerGuarded(SALON_ID, input);

    expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON_ID, moduleKey: "customers" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "customers.active" });
  });

  it("da de alta el cliente en el salón cuando el plan lo permite", async () => {
    expect(await createCustomerGuarded(SALON_ID, input)).toEqual(ok("customer-id"));
    expect(createCustomerProfile).toHaveBeenCalledWith(SALON_ID, input);
  });

  it("si el módulo no está en el plan devuelve su error sin crear", async () => {
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));

    expect(await createCustomerGuarded(SALON_ID, input)).toEqual(err("Módulo no incluido en tu plan."));
    expect(checkPlanLimit).not.toHaveBeenCalled();
    expect(createCustomerProfile).not.toHaveBeenCalled();
  });

  it("si no queda cupo de clientes devuelve el error del plan sin crear", async () => {
    vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de clientes alcanzado."));

    expect(await createCustomerGuarded(SALON_ID, input)).toEqual(err("Límite de clientes alcanzado."));
    expect(createCustomerProfile).not.toHaveBeenCalled();
  });
});
