import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { captureError } from "@/infra/observability";
import type * as customersRepo from "@/features/customers/data/customers.repo";
import { findCustomerTemporaryFlag } from "@/features/customers/data/customers.repo";
import type { Database } from "@/types/database.types";
import { ok, type Result } from "@/infra/result";
import {
  deleteTemporaryCustomer,
  isTemporaryCustomer,
  promoteCustomer,
  type CustomerTemporaryDeps,
} from "./customer-temporary";

// isTemporaryCustomer es una consulta pura sin deps: se mockea solo su lectura
// y el resto del módulo real se conserva.
vi.mock("@/features/customers/data/customers.repo", async (importOriginal) => ({
  ...(await importOriginal<typeof customersRepo>()),
  findCustomerTemporaryFlag: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedCaptureError = vi.mocked(captureError);
const mockedFindFlag = vi.mocked(findCustomerTemporaryFlag);

const SALON_ID = "salon-1";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

const baseCustomer: CustomerRow = {
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

/** Fakes tipados: por defecto hay cupo y las escrituras funcionan. */
interface TemporaryFakes {
  deps: CustomerTemporaryDeps;
  assertQuota: Mock<CustomerTemporaryDeps["assertQuota"]>;
  updateCustomer: Mock<CustomerTemporaryDeps["updateCustomer"]>;
  discard: Mock<CustomerTemporaryDeps["discardTemporaryCustomerRpc"]>;
}

function makeFakes(): TemporaryFakes {
  const assertQuota = vi.fn<CustomerTemporaryDeps["assertQuota"]>(async (): Promise<Result<void>> => ok(undefined));
  const updateCustomer = vi.fn<CustomerTemporaryDeps["updateCustomer"]>(async () => baseCustomer);
  const discard = vi.fn<CustomerTemporaryDeps["discardTemporaryCustomerRpc"]>(async () => undefined);
  return { deps: { assertQuota, updateCustomer, discardTemporaryCustomerRpc: discard }, assertQuota, updateCustomer, discard };
}

describe("customer-temporary (ramas)", () => {
  let fakes: TemporaryFakes;

  beforeEach(() => {
    vi.clearAllMocks();
    fakes = makeFakes();
  });

  describe("promoteCustomer", () => {
    it("promueve el temporal a cliente permanente activo", async () => {
      expect(await promoteCustomer("temp-1", SALON_ID, fakes.deps)).toEqual({ ok: true, value: undefined });
      expect(fakes.updateCustomer).toHaveBeenCalledWith("temp-1", SALON_ID, {
        is_temporary: false,
        is_active: true,
      });
    });

    it("registra el error y devuelve mensaje generico si falla la promocion", async () => {
      const failure = new Error("caida");
      fakes.updateCustomer.mockRejectedValue(failure);

      expect(await promoteCustomer("temp-1", SALON_ID, fakes.deps)).toEqual({
        ok: false,
        error: "Error al guardar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "temporary" });
    });
  });

  describe("deleteTemporaryCustomer", () => {
    it("descarta el temporal mediante la RPC y devuelve ok", async () => {
      expect(await deleteTemporaryCustomer("temp-1", fakes.deps)).toEqual({ ok: true, value: undefined });
      expect(fakes.discard).toHaveBeenCalledWith("temp-1");
      expect(mockedCaptureError).not.toHaveBeenCalled();
    });

    it("traduce el SQLSTATE 22023 a un mensaje publico fijo sin registrar error", async () => {
      fakes.discard.mockRejectedValue({ code: "22023", message: "texto crudo de Postgres" });

      expect(await deleteTemporaryCustomer("temp-1", fakes.deps)).toEqual({
        ok: false,
        error: "El cliente no se puede descartar: tiene citas activas o completadas.",
      });
      expect(mockedCaptureError).not.toHaveBeenCalled();
    });

    it("traduce el SQLSTATE 42501 a mensaje de permisos", async () => {
      fakes.discard.mockRejectedValue({ code: "42501", message: "texto crudo de Postgres" });

      expect(await deleteTemporaryCustomer("temp-1", fakes.deps)).toEqual({
        ok: false,
        error: "No tienes permiso para descartar clientes.",
      });
    });

    it("traduce el SQLSTATE P0002 a mensaje de cliente inexistente", async () => {
      fakes.discard.mockRejectedValue({ code: "P0002", message: "texto crudo de Postgres" });

      expect(await deleteTemporaryCustomer("temp-1", fakes.deps)).toEqual({
        ok: false,
        error: "El cliente no existe en este salón.",
      });
    });

    it("registra el error y devuelve mensaje generico si falla por otra causa", async () => {
      const failure = new Error("caida");
      fakes.discard.mockRejectedValue(failure);

      expect(await deleteTemporaryCustomer("temp-1", fakes.deps)).toEqual({
        ok: false,
        error: "Error al descartar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "temporary" });
    });
  });

  describe("deleteTemporaryCustomer (SQLSTATE sin traducir)", () => {
    it("registra el error y devuelve el mensaje generico ante un SQLSTATE no mapeado", async () => {
      const failure = { code: "23503", message: "fk de Postgres" };
      fakes.discard.mockRejectedValue(failure);

      expect(await deleteTemporaryCustomer("temp-1", fakes.deps)).toEqual({
        ok: false,
        error: "Error al descartar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "temporary" });
    });
  });

  describe("isTemporaryCustomer", () => {
    it("devuelve true si el cliente del salon esta marcado como temporal", async () => {
      mockedFindFlag.mockResolvedValue(true);

      expect(await isTemporaryCustomer("cust-1", "salon-1")).toBe(true);
      expect(mockedFindFlag).toHaveBeenCalledWith("cust-1", "salon-1");
    });

    it("devuelve false si el cliente es permanente", async () => {
      mockedFindFlag.mockResolvedValue(false);

      expect(await isTemporaryCustomer("cust-1", "salon-1")).toBe(false);
    });

    it("devuelve false si el cliente no existe en el salon", async () => {
      mockedFindFlag.mockResolvedValue(null);

      expect(await isTemporaryCustomer("cust-x", "salon-1")).toBe(false);
    });
  });
});
