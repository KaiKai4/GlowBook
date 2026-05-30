import { beforeEach, describe, expect, it, vi } from "vitest";
import { findCustomerByEmail, findCustomerByPhone } from "../data/customers.repo";
import {
  checkPermanentCustomerByPhone,
  findArchivedCustomerByContact,
  rejectArchivedDuplicate,
} from "./customer-duplicates";

vi.mock("../data/customers.repo", () => ({
  findCustomerByEmail: vi.fn(),
  findCustomerByPhone: vi.fn(),
}));

const mockedFindCustomerByEmail = vi.mocked(findCustomerByEmail);
const mockedFindCustomerByPhone = vi.mocked(findCustomerByPhone);

function customer(overrides: Record<string, unknown> = {}) {
  return {
    id: "customer-1",
    first_name: "Ana",
    last_name: "Vega",
    phone: "60000000",
    email: "ana@example.com",
    is_active: true,
    is_temporary: false,
    ...overrides,
  };
}

describe("customer duplicate guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindCustomerByEmail.mockResolvedValue(null);
    mockedFindCustomerByPhone.mockResolvedValue(null);
  });

  it("ignores blank phone values and temporary customers in permanent duplicate checks", async () => {
    await expect(checkPermanentCustomerByPhone("salon-1", " ")).resolves.toEqual({
      exists: false,
    });
    expect(mockedFindCustomerByPhone).not.toHaveBeenCalled();

    mockedFindCustomerByPhone.mockResolvedValue(customer({ is_temporary: true }) as never);
    await expect(checkPermanentCustomerByPhone("salon-1", "60000000")).resolves.toEqual({
      exists: false,
    });
  });

  it("marks permanent phone duplicates as active or archived", async () => {
    mockedFindCustomerByPhone.mockResolvedValue(customer({ is_active: false }) as never);

    await expect(checkPermanentCustomerByPhone("salon-1", "60000000")).resolves.toEqual({
      exists: true,
      archived: true,
    });
  });

  it("finds an archived customer by phone or email and returns a display-safe match", async () => {
    mockedFindCustomerByPhone.mockResolvedValue(null);
    mockedFindCustomerByEmail.mockResolvedValue(
      customer({ id: "archived-1", is_active: false }) as never
    );

    await expect(
      findArchivedCustomerByContact("salon-1", "60000000", "ana@example.com")
    ).resolves.toEqual({
      id: "archived-1",
      name: "Ana Vega",
      phone: "60000000",
      email: "ana@example.com",
    });
  });

  it("rejects creates that would duplicate archived permanent customer history", async () => {
    mockedFindCustomerByPhone.mockResolvedValue(
      customer({ id: "archived-1", is_active: false }) as never
    );

    const result = await rejectArchivedDuplicate("salon-1", {
      phone: "60000000",
      email: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("cliente archivado");
  });
});
