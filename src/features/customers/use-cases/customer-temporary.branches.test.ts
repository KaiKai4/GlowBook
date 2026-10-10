import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit } from "@/features/billing";
import { captureError } from "@/infra/observability";
import {
  findCustomerTemporaryFlag,
  updateCustomer,
} from "@/features/customers/data/customers.repo";
import { discardTemporaryCustomerRpc } from "@/features/customers/data/rpc/discard-temporary-customer";
import type { Database } from "@/types/database.types";
import {
  deleteTemporaryCustomer,
  isTemporaryCustomer,
  promoteCustomer,
} from "./customer-temporary";

vi.mock("@/features/customers/data/customers.repo", () => ({
  updateCustomer: vi.fn(),
  findCustomerTemporaryFlag: vi.fn(),
}));

vi.mock("@/features/customers/data/rpc/discard-temporary-customer", () => ({
  discardTemporaryCustomerRpc: vi.fn(),
}));

vi.mock("@/features/billing", () => ({
  checkPlanLimit: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedDiscard = vi.mocked(discardTemporaryCustomerRpc);
const mockedUpdate = vi.mocked(updateCustomer);
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

function customerRecord(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return { ...baseCustomer, ...overrides };
}

describe("customer-temporary (ramas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanLimit).mockResolvedValue({ ok: true, value: undefined });
  });

  describe("promoteCustomer", () => {
    it("promueve el temporal a cliente permanente activo", async () => {
      mockedUpdate.mockResolvedValue(customerRecord({}));

      expect(await promoteCustomer("temp-1", SALON_ID)).toEqual({ ok: true, value: undefined });
      expect(mockedUpdate).toHaveBeenCalledWith("temp-1", SALON_ID, {
        is_temporary: false,
        is_active: true,
      });
    });

    it("registra el error y devuelve mensaje generico si falla la promocion", async () => {
      const failure = new Error("caida");
      mockedUpdate.mockRejectedValue(failure);

      expect(await promoteCustomer("temp-1", SALON_ID)).toEqual({
        ok: false,
        error: "Error al guardar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "temporary" });
    });
  });

  describe("deleteTemporaryCustomer", () => {
    it("descarta el temporal mediante la RPC y devuelve ok", async () => {
      mockedDiscard.mockResolvedValue(undefined);

      expect(await deleteTemporaryCustomer("temp-1")).toEqual({ ok: true, value: undefined });
      expect(mockedDiscard).toHaveBeenCalledWith("temp-1");
      expect(mockedCaptureError).not.toHaveBeenCalled();
    });

    it("traduce el SQLSTATE 22023 a un mensaje publico fijo sin registrar error", async () => {
      mockedDiscard.mockRejectedValue({ code: "22023", message: "texto crudo de Postgres" });

      expect(await deleteTemporaryCustomer("temp-1")).toEqual({
        ok: false,
        error: "El cliente no se puede descartar: tiene citas activas o completadas.",
      });
      expect(mockedCaptureError).not.toHaveBeenCalled();
    });

    it("traduce el SQLSTATE 42501 a mensaje de permisos", async () => {
      mockedDiscard.mockRejectedValue({ code: "42501", message: "texto crudo de Postgres" });

      expect(await deleteTemporaryCustomer("temp-1")).toEqual({
        ok: false,
        error: "No tienes permiso para descartar clientes.",
      });
    });

    it("traduce el SQLSTATE P0002 a mensaje de cliente inexistente", async () => {
      mockedDiscard.mockRejectedValue({ code: "P0002", message: "texto crudo de Postgres" });

      expect(await deleteTemporaryCustomer("temp-1")).toEqual({
        ok: false,
        error: "El cliente no existe en este salón.",
      });
    });

    it("registra el error y devuelve mensaje generico si falla por otra causa", async () => {
      const failure = new Error("caida");
      mockedDiscard.mockRejectedValue(failure);

      expect(await deleteTemporaryCustomer("temp-1")).toEqual({
        ok: false,
        error: "Error al descartar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "temporary" });
    });
  });

  describe("deleteTemporaryCustomer (SQLSTATE sin traducir)", () => {
    it("registra el error y devuelve el mensaje generico ante un SQLSTATE no mapeado", async () => {
      const failure = { code: "23503", message: "fk de Postgres" };
      mockedDiscard.mockRejectedValue(failure);

      expect(await deleteTemporaryCustomer("temp-1")).toEqual({
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
