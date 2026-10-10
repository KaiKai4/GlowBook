import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { err, ok, type Result } from "@/infra/result";
import {
  deleteTemporaryCustomer,
  promoteCustomer,
  type CustomerTemporaryDeps,
} from "./customer-temporary";

/** Fakes tipados: por defecto hay cupo, la actualización y el descarte funcionan. */
interface TemporaryFakes {
  deps: CustomerTemporaryDeps;
  assertQuota: Mock<CustomerTemporaryDeps["assertQuota"]>;
  updateCustomer: Mock<CustomerTemporaryDeps["updateCustomer"]>;
  discard: Mock<CustomerTemporaryDeps["discardTemporaryCustomerRpc"]>;
}

function makeFakes(): TemporaryFakes {
  const assertQuota = vi.fn<CustomerTemporaryDeps["assertQuota"]>(async (): Promise<Result<void>> => ok(undefined));
  const updateCustomer = vi.fn<CustomerTemporaryDeps["updateCustomer"]>(async () => ({ id: "customer-1" }));
  const discard = vi.fn<CustomerTemporaryDeps["discardTemporaryCustomerRpc"]>(async () => undefined);
  return { deps: { assertQuota, updateCustomer, discardTemporaryCustomerRpc: discard }, assertQuota, updateCustomer, discard };
}

describe("customer temporary workflow", () => {
  let fakes: TemporaryFakes;

  beforeEach(() => {
    fakes = makeFakes();
  });

  it("no promueve un temporal si el plan no tiene cupo de clientes activos", async () => {
    fakes.assertQuota.mockResolvedValue(err("Límite de clientes alcanzado."));

    await expect(promoteCustomer("customer-1", "salon-1", fakes.deps)).resolves.toEqual({
      ok: false,
      error: "Límite de clientes alcanzado.",
    });
    expect(fakes.assertQuota).toHaveBeenCalledWith("salon-1");
    expect(fakes.updateCustomer).not.toHaveBeenCalled();
  });

  it("promotes and discards temporary customers through their narrow lifecycle actions", async () => {
    await expect(promoteCustomer("customer-1", "salon-1", fakes.deps)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(fakes.updateCustomer).toHaveBeenCalledWith("customer-1", "salon-1", {
      is_temporary: false,
      is_active: true,
    });

    await expect(deleteTemporaryCustomer("customer-1", fakes.deps)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(fakes.discard).toHaveBeenCalledWith("customer-1");
  });
});
