import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { captureError } from "@/infra/observability";
import type { Database } from "@/types/database.types";
import { ok, type Result } from "@/infra/result";
import {
  archiveCustomer,
  reactivateCustomer,
  type CustomerLifecycleDeps,
} from "./customer-lifecycle";

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedCaptureError = vi.mocked(captureError);

const SALON_ID = "salon-1";

const customerRow: Database["public"]["Tables"]["customers"]["Row"] = {
  id: "cust-1",
  salon_id: SALON_ID,
  first_name: "Ana",
  last_name: "Perez",
  phone: "61234567",
  email: null,
  birth_date: null,
  notes: "",
  is_temporary: false,
  is_active: true,
  search_name: "perez ana",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

/** Fakes tipados: por defecto hay cupo y la actualización funciona. */
interface LifecycleFakes {
  deps: CustomerLifecycleDeps;
  assertQuota: Mock<CustomerLifecycleDeps["assertQuota"]>;
  updateCustomer: Mock<CustomerLifecycleDeps["updateCustomer"]>;
}

function makeFakes(): LifecycleFakes {
  const assertQuota = vi.fn<CustomerLifecycleDeps["assertQuota"]>(async (): Promise<Result<void>> => ok(undefined));
  const updateCustomer = vi.fn<CustomerLifecycleDeps["updateCustomer"]>(async () => customerRow);
  return { deps: { assertQuota, updateCustomer }, assertQuota, updateCustomer };
}

describe("customer-lifecycle (ramas de error)", () => {
  let fakes: LifecycleFakes;

  beforeEach(() => {
    vi.clearAllMocks();
    fakes = makeFakes();
  });

  describe("reactivateCustomer", () => {
    it("marca al cliente como activo y permanente dentro del salón", async () => {
      expect(await reactivateCustomer("cust-1", SALON_ID, fakes.deps)).toEqual({ ok: true, value: undefined });
      expect(fakes.updateCustomer).toHaveBeenCalledWith("cust-1", SALON_ID, {
        is_active: true,
        is_temporary: false,
      });
    });

    it("registra el error y devuelve mensaje generico si falla la reactivacion", async () => {
      const failure = new Error("caida");
      fakes.updateCustomer.mockRejectedValue(failure);

      expect(await reactivateCustomer("cust-1", SALON_ID, fakes.deps)).toEqual({
        ok: false,
        error: "No se pudo reactivar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "lifecycle" });
    });
  });

  describe("archiveCustomer", () => {
    it("archiva solo desactivando el cliente y devuelve el mensaje de trazabilidad", async () => {
      expect(await archiveCustomer("cust-1", SALON_ID, fakes.deps)).toEqual({
        ok: true,
        value: {
          outcome: "archived",
          message: "Cliente archivado conservando su información para trazabilidad.",
        },
      });
      expect(fakes.updateCustomer).toHaveBeenCalledWith("cust-1", SALON_ID, { is_active: false });
    });

    it("registra el error y devuelve mensaje generico si falla el archivado", async () => {
      const failure = new Error("caida");
      fakes.updateCustomer.mockRejectedValue(failure);

      expect(await archiveCustomer("cust-1", SALON_ID, fakes.deps)).toEqual({
        ok: false,
        error: "No se pudo archivar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "lifecycle" });
    });
  });
});
