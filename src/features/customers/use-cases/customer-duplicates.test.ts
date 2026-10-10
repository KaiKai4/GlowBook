import { describe, expect, it, vi } from "vitest";
import type { DuplicateCandidate } from "@/features/customers/domain/duplicates";
import {
  checkPermanentCustomerByPhone,
  findArchivedCustomerByContact,
  rejectArchivedDuplicate,
  type CustomerDuplicatesDeps,
} from "./customer-duplicates";

function customer(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
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

/** Fakes tipados: por defecto no hay coincidencias en la base. */
function makeDeps(overrides: Partial<CustomerDuplicatesDeps> = {}): CustomerDuplicatesDeps {
  return {
    findCustomerByPhone: vi.fn<CustomerDuplicatesDeps["findCustomerByPhone"]>(async () => null),
    findCustomerByEmail: vi.fn<CustomerDuplicatesDeps["findCustomerByEmail"]>(async () => null),
    ...overrides,
  };
}

describe("customer duplicate guards", () => {
  it("ignores blank phone values and temporary customers in permanent duplicate checks", async () => {
    const deps = makeDeps();
    await expect(checkPermanentCustomerByPhone("salon-1", " ", deps)).resolves.toEqual({
      exists: false,
    });
    expect(deps.findCustomerByPhone).not.toHaveBeenCalled();

    deps.findCustomerByPhone = vi.fn(async () => customer({ is_temporary: true }));
    await expect(checkPermanentCustomerByPhone("salon-1", "60000000", deps)).resolves.toEqual({
      exists: false,
    });
  });

  it("marks permanent phone duplicates as active or archived", async () => {
    const deps = makeDeps({ findCustomerByPhone: async () => customer({ is_active: false }) });

    await expect(checkPermanentCustomerByPhone("salon-1", "60000000", deps)).resolves.toEqual({
      exists: true,
      archived: true,
    });
  });

  it("finds an archived customer by phone or email and returns a display-safe match", async () => {
    const deps = makeDeps({
      findCustomerByEmail: async () => customer({ id: "archived-1", is_active: false }),
    });

    await expect(
      findArchivedCustomerByContact("salon-1", "60000000", "ana@example.com", deps)
    ).resolves.toEqual({
      id: "archived-1",
      name: "Ana Vega",
      phone: "60000000",
      email: "ana@example.com",
    });
  });

  it("rejects creates that would duplicate archived permanent customer history", async () => {
    const deps = makeDeps({
      findCustomerByPhone: async () => customer({ id: "archived-1", is_active: false }),
    });

    const result = await rejectArchivedDuplicate(
      "salon-1",
      { phone: "60000000", email: null },
      deps
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Ya existe un cliente");
  });
});
