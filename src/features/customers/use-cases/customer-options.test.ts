import { describe, expect, it, vi } from "vitest";
import { findCustomers } from "../data/customers.repo";
import { getActiveCustomerOptions } from "./customer-options";

vi.mock("../data/customers.repo", () => ({
  findCustomers: vi.fn(),
}));

const mockedFindCustomers = vi.mocked(findCustomers);

describe("customer options", () => {
  it("loads active customers through a narrow option Interface", async () => {
    mockedFindCustomers.mockResolvedValue({
      data: [
        { id: "customer-1", first_name: "Ana", last_name: "Mora" },
        { id: "customer-2", first_name: "Luis", last_name: "" },
      ],
      total: 2,
    } as Awaited<ReturnType<typeof findCustomers>>);

    await expect(getActiveCustomerOptions("salon-1", 50)).resolves.toEqual([
      { id: "customer-1", name: "Ana Mora" },
      { id: "customer-2", name: "Luis" },
    ]);

    expect(mockedFindCustomers).toHaveBeenCalledWith("salon-1", {
      perPage: 50,
      isActive: true,
    });
  });
});
