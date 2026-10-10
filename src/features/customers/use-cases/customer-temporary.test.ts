import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit } from "@/features/billing";
import {
  createCustomer,
  findCustomerByPhone,
  updateCustomer,
} from "../data/customers.repo";
import { discardTemporaryCustomerRpc } from "../data/rpc/discard-temporary-customer";
import {
  deleteTemporaryCustomer,
  promoteCustomer,
} from "./customer-temporary";

vi.mock("@/features/billing", () => ({
  checkPlanLimit: vi.fn(),
}));

vi.mock("../data/customers.repo", () => ({
  createCustomer: vi.fn(),
  findCustomerByPhone: vi.fn(),
  updateCustomer: vi.fn(),
}));

vi.mock("../data/rpc/discard-temporary-customer", () => ({
  discardTemporaryCustomerRpc: vi.fn(),
}));

const mockedCreateCustomer = vi.mocked(createCustomer);
const mockedDiscard = vi.mocked(discardTemporaryCustomerRpc);
const mockedFindCustomerByPhone = vi.mocked(findCustomerByPhone);
const mockedUpdateCustomer = vi.mocked(updateCustomer);

function customer(overrides: Record<string, unknown> = {}) {
  return {
    id: "customer-1",
    first_name: "Ana",
    last_name: "Vega",
    phone: "60000000",
    email: null,
    is_active: true,
    is_temporary: true,
    ...overrides,
  };
}

describe("customer temporary workflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedCreateCustomer.mockResolvedValue(customer() as never);
    mockedDiscard.mockResolvedValue(undefined);
    mockedFindCustomerByPhone.mockResolvedValue(null);
    mockedUpdateCustomer.mockResolvedValue(customer() as never);
    vi.mocked(checkPlanLimit).mockResolvedValue({ ok: true, value: undefined });
  });

  it("no promueve un temporal si el plan no tiene cupo de clientes activos", async () => {
    vi.mocked(checkPlanLimit).mockResolvedValue({ ok: false, error: "Límite de clientes alcanzado." });

    await expect(promoteCustomer("customer-1", "salon-1")).resolves.toEqual({
      ok: false,
      error: "Límite de clientes alcanzado.",
    });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: "salon-1", metricKey: "customers.active" });
    expect(mockedUpdateCustomer).not.toHaveBeenCalled();
  });

  it("promotes and discards temporary customers through their narrow lifecycle actions", async () => {
    await expect(promoteCustomer("customer-1", "salon-1")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(mockedUpdateCustomer).toHaveBeenCalledWith("customer-1", "salon-1", {
      is_temporary: false,
      is_active: true,
    });

    await expect(deleteTemporaryCustomer("customer-1")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(mockedDiscard).toHaveBeenCalledWith("customer-1");
  });
});
