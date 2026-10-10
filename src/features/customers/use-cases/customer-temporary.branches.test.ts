import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit } from "@/features/billing";
import { captureError } from "@/infra/observability";
import { deleteCustomer, updateCustomer } from "@/features/customers/data/customers.repo";
import type { Database } from "@/types/database.types";
import {
  deleteTemporaryCustomer,
  promoteCustomer,
} from "./customer-temporary";

vi.mock("@/features/customers/data/customers.repo", () => ({
  deleteCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));

vi.mock("@/features/billing", () => ({
  checkPlanLimit: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedDelete = vi.mocked(deleteCustomer);
const mockedUpdate = vi.mocked(updateCustomer);
const mockedCaptureError = vi.mocked(captureError);

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
    it("borra el temporal del salon indicado", async () => {
      mockedDelete.mockResolvedValue(undefined);

      expect(await deleteTemporaryCustomer("temp-1", SALON_ID)).toEqual({ ok: true, value: undefined });
      expect(mockedDelete).toHaveBeenCalledWith("temp-1", SALON_ID);
    });

    it("registra el error y devuelve mensaje generico si falla el borrado", async () => {
      const failure = new Error("caida");
      mockedDelete.mockRejectedValue(failure);

      expect(await deleteTemporaryCustomer("temp-1", SALON_ID)).toEqual({
        ok: false,
        error: "Error al descartar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "temporary" });
    });
  });
});
