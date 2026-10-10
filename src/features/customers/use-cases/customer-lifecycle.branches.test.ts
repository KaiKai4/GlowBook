import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit } from "@/features/billing";
import { captureError } from "@/infra/observability";
import { updateCustomer } from "@/features/customers/data/customers.repo";
import type { Database } from "@/types/database.types";
import { archiveCustomer, reactivateCustomer } from "./customer-lifecycle";

vi.mock("@/features/customers/data/customers.repo", () => ({
  updateCustomer: vi.fn(),
}));

vi.mock("@/features/billing", () => ({
  checkPlanLimit: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedUpdate = vi.mocked(updateCustomer);
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

describe("customer-lifecycle (ramas de error)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanLimit).mockResolvedValue({ ok: true, value: undefined });
  });

  describe("reactivateCustomer", () => {
    it("marca al cliente como activo y permanente dentro del salón", async () => {
      mockedUpdate.mockResolvedValue(customerRow);

      expect(await reactivateCustomer("cust-1", SALON_ID)).toEqual({ ok: true, value: undefined });
      expect(mockedUpdate).toHaveBeenCalledWith("cust-1", SALON_ID, {
        is_active: true,
        is_temporary: false,
      });
    });

    it("registra el error y devuelve mensaje generico si falla la reactivacion", async () => {
      const failure = new Error("caida");
      mockedUpdate.mockRejectedValue(failure);

      expect(await reactivateCustomer("cust-1", SALON_ID)).toEqual({
        ok: false,
        error: "No se pudo reactivar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "lifecycle" });
    });
  });

  describe("archiveCustomer", () => {
    it("archiva solo desactivando el cliente y devuelve el mensaje de trazabilidad", async () => {
      mockedUpdate.mockResolvedValue(customerRow);

      expect(await archiveCustomer("cust-1", SALON_ID)).toEqual({
        ok: true,
        value: {
          outcome: "archived",
          message: "Cliente archivado conservando su información para trazabilidad.",
        },
      });
      expect(mockedUpdate).toHaveBeenCalledWith("cust-1", SALON_ID, { is_active: false });
    });

    it("registra el error y devuelve mensaje generico si falla el archivado", async () => {
      const failure = new Error("caida");
      mockedUpdate.mockRejectedValue(failure);

      expect(await archiveCustomer("cust-1", SALON_ID)).toEqual({
        ok: false,
        error: "No se pudo archivar el cliente.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "customers", action: "lifecycle" });
    });
  });
});
