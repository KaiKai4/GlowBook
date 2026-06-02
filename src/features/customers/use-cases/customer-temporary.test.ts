import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCustomer,
  deleteCustomer,
  findCustomerByPhone,
  updateCustomer,
} from "../data/customers.repo";
import {
  deleteTemporaryCustomer,
  findOrCreateTemporaryCustomer,
  promoteCustomer,
} from "./customer-temporary";

vi.mock("../data/customers.repo", () => ({
  createCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  findCustomerByPhone: vi.fn(),
  updateCustomer: vi.fn(),
}));

const mockedCreateCustomer = vi.mocked(createCustomer);
const mockedDeleteCustomer = vi.mocked(deleteCustomer);
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
    mockedDeleteCustomer.mockResolvedValue(undefined);
    mockedFindCustomerByPhone.mockResolvedValue(null);
    mockedUpdateCustomer.mockResolvedValue(customer() as never);
  });

  it("creates a temporary inactive customer for appointment intake", async () => {
    const result = await findOrCreateTemporaryCustomer({
      salonId: "salon-1",
      firstName: " Ana ",
      lastName: " Vega ",
      phone: "6000-0000",
    });

    expect(result).toEqual({ ok: true, value: "customer-1" });
    expect(mockedCreateCustomer).toHaveBeenCalledWith("salon-1", {
      first_name: "Ana",
      last_name: "Vega",
      phone: "60000000",
      is_temporary: true,
      is_active: false,
    });
  });

  it("updates an existing temporary customer when phone uniqueness is hit", async () => {
    mockedCreateCustomer.mockRejectedValue(new Error("uq_customer_phone_per_salon"));
    mockedFindCustomerByPhone.mockResolvedValue(customer({ id: "existing-temp" }) as never);
    mockedUpdateCustomer.mockResolvedValue(customer({ id: "existing-temp" }) as never);

    const result = await findOrCreateTemporaryCustomer({
      salonId: "salon-1",
      firstName: "Lia",
      lastName: "Mora",
      phone: "60000000",
    });

    expect(result).toEqual({ ok: true, value: "existing-temp" });
    expect(mockedUpdateCustomer).toHaveBeenCalledWith("existing-temp", "salon-1", {
      first_name: "Lia",
      last_name: "Mora",
    });
  });

  it("reuses an active permanent customer with the same phone", async () => {
    mockedCreateCustomer.mockRejectedValue(new Error("uq_customer_phone_per_salon"));
    mockedFindCustomerByPhone.mockResolvedValue(
      customer({ id: "permanent", is_temporary: false, is_active: true }) as never
    );

    await expect(
      findOrCreateTemporaryCustomer({
        salonId: "salon-1",
        firstName: "Ana",
        lastName: "Vega",
        phone: "60000000",
      })
    ).resolves.toEqual({ ok: true, value: "permanent" });
    expect(mockedUpdateCustomer).not.toHaveBeenCalled();
  });

  it("blocks booking against an archived permanent customer", async () => {
    mockedCreateCustomer.mockRejectedValue(new Error("uq_customer_phone_per_salon"));
    mockedFindCustomerByPhone.mockResolvedValue(
      customer({ is_temporary: false, is_active: false }) as never
    );

    const result = await findOrCreateTemporaryCustomer({
      salonId: "salon-1",
      firstName: "Ana",
      lastName: "Vega",
      phone: "60000000",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("cliente esta archivado");
  });

  it("promotes and deletes temporary customers through their narrow lifecycle actions", async () => {
    await expect(promoteCustomer("customer-1", "salon-1")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(mockedUpdateCustomer).toHaveBeenCalledWith("customer-1", "salon-1", {
      is_temporary: false,
      is_active: true,
    });

    await expect(deleteTemporaryCustomer("customer-1", "salon-1")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(mockedDeleteCustomer).toHaveBeenCalledWith("customer-1", "salon-1");
  });
});
