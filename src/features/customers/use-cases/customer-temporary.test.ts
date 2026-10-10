import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCustomer,
  deleteCustomer,
  findCustomerByPhone,
  updateCustomer,
} from "../data/customers.repo";
import {
  deleteTemporaryCustomer,
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
