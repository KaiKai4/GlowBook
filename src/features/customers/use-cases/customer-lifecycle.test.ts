import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { err, ok, type Result } from "@/infra/result";
import {
  archiveCustomer,
  reactivateCustomer,
  type CustomerLifecycleDeps,
} from "./customer-lifecycle";

/** Fakes tipados: por defecto hay cupo y la actualización funciona. */
interface LifecycleFakes {
  deps: CustomerLifecycleDeps;
  assertQuota: Mock<CustomerLifecycleDeps["assertQuota"]>;
  updateCustomer: Mock<CustomerLifecycleDeps["updateCustomer"]>;
}

function makeFakes(): LifecycleFakes {
  const assertQuota = vi.fn<CustomerLifecycleDeps["assertQuota"]>(async (): Promise<Result<void>> => ok(undefined));
  const updateCustomer = vi.fn<CustomerLifecycleDeps["updateCustomer"]>(async () => ({ id: "customer-1" }));
  return { deps: { assertQuota, updateCustomer }, assertQuota, updateCustomer };
}

describe("customer lifecycle", () => {
  let fakes: LifecycleFakes;

  beforeEach(() => {
    fakes = makeFakes();
  });

  it("no reactiva un archivado si el plan no tiene cupo de clientes activos", async () => {
    fakes.assertQuota.mockResolvedValue(err("Límite de clientes alcanzado."));

    await expect(reactivateCustomer("customer-1", "salon-1", fakes.deps)).resolves.toEqual({
      ok: false,
      error: "Límite de clientes alcanzado.",
    });
    expect(fakes.assertQuota).toHaveBeenCalledWith("salon-1");
    expect(fakes.updateCustomer).not.toHaveBeenCalled();
  });

  it("reactivates a customer as permanent and active", async () => {
    await expect(reactivateCustomer("customer-1", "salon-1", fakes.deps)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(fakes.updateCustomer).toHaveBeenCalledWith("customer-1", "salon-1", {
      is_active: true,
      is_temporary: false,
    });
  });

  it("archives the customer without deleting historical data", async () => {
    const result = await archiveCustomer("customer-1", "salon-1", fakes.deps);

    expect(fakes.updateCustomer).toHaveBeenCalledWith("customer-1", "salon-1", {
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
    fakes.updateCustomer.mockRejectedValue(new Error("database down"));

    await expect(reactivateCustomer("customer-1", "salon-1", fakes.deps)).resolves.toEqual({
      ok: false,
      error: "No se pudo reactivar el cliente.",
    });
  });
});
