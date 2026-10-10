import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit } from "@/features/billing";
import { updateCustomer } from "../data/customers.repo";
import { archiveCustomer, reactivateCustomer } from "./customer-lifecycle";

vi.mock("@/features/billing", () => ({
  checkPlanLimit: vi.fn(),
}));

vi.mock("../data/customers.repo", () => ({
  updateCustomer: vi.fn(),
}));

const mockedUpdateCustomer = vi.mocked(updateCustomer);

describe("customer lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedUpdateCustomer.mockResolvedValue({ id: "customer-1" } as never);
    vi.mocked(checkPlanLimit).mockResolvedValue({ ok: true, value: undefined });
  });

  it("no reactiva un archivado si el plan no tiene cupo de clientes activos", async () => {
    vi.mocked(checkPlanLimit).mockResolvedValue({ ok: false, error: "Límite de clientes alcanzado." });

    await expect(reactivateCustomer("customer-1", "salon-1")).resolves.toEqual({
      ok: false,
      error: "Límite de clientes alcanzado.",
    });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: "salon-1", metricKey: "customers.active" });
    expect(mockedUpdateCustomer).not.toHaveBeenCalled();
  });

  it("reactivates a customer as permanent and active", async () => {
    await expect(reactivateCustomer("customer-1", "salon-1")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(mockedUpdateCustomer).toHaveBeenCalledWith("customer-1", "salon-1", {
      is_active: true,
      is_temporary: false,
    });
  });

  it("archives the customer without deleting historical data", async () => {
    const result = await archiveCustomer("customer-1", "salon-1");

    expect(mockedUpdateCustomer).toHaveBeenCalledWith("customer-1", "salon-1", {
      is_active: false,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        outcome: "archived",
        message: "Cliente archivado conservando su información para trazabilidad.",
      },
    });
  });

  it("returns a business error when the repository update fails", async () => {
    mockedUpdateCustomer.mockRejectedValue(new Error("database down"));

    await expect(reactivateCustomer("customer-1", "salon-1")).resolves.toEqual({
      ok: false,
      error: "No se pudo reactivar el cliente.",
    });
  });
});
