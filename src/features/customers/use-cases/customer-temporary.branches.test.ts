import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import {
  createCustomer,
  deleteCustomer,
  findCustomerByPhone,
  updateCustomer,
} from "@/features/customers/data/customers.repo";
import { phoneValidationMessage } from "@/lib/utils/phone";
import type { Database } from "@/types/database.types";
import {
  deleteTemporaryCustomer,
  findOrCreateTemporaryCustomer,
  promoteCustomer,
} from "./customer-temporary";

vi.mock("@/features/customers/data/customers.repo", () => ({
  createCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  findCustomerByPhone: vi.fn(),
  updateCustomer: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

const mockedCreate = vi.mocked(createCustomer);
const mockedDelete = vi.mocked(deleteCustomer);
const mockedFindByPhone = vi.mocked(findCustomerByPhone);
const mockedUpdate = vi.mocked(updateCustomer);
const mockedCaptureError = vi.mocked(captureError);

const SALON_ID = "salon-1";
// Error con codigo de unicidad de Postgres: el caso de telefono duplicado.
const UNIQUE_VIOLATION = { code: "23505", message: "duplicate key" };

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
  });

  describe("findOrCreateTemporaryCustomer", () => {
    it("rechaza un telefono invalido sin consultar ni crear nada", async () => {
      const result = await findOrCreateTemporaryCustomer({
        salonId: SALON_ID,
        firstName: "Ana",
        lastName: "Perez",
        phone: "123",
      });

      expect(result).toEqual({ ok: false, error: phoneValidationMessage() });
      expect(mockedCreate).not.toHaveBeenCalled();
      expect(mockedFindByPhone).not.toHaveBeenCalled();
    });

    it("crea un cliente temporal inactivo con nombres recortados y telefono normalizado", async () => {
      mockedCreate.mockResolvedValue(customerRecord({ id: "temp-1", is_temporary: true }));

      const result = await findOrCreateTemporaryCustomer({
        salonId: SALON_ID,
        firstName: "  Ana ",
        lastName: " Perez  ",
        phone: " +507 6123 4567 ",
      });

      expect(result).toEqual({ ok: true, value: "temp-1" });
      expect(mockedCreate).toHaveBeenCalledWith(SALON_ID, {
        first_name: "Ana",
        last_name: "Perez",
        phone: "61234567",
        is_temporary: true,
        is_active: false,
      });
    });

    it("guarda telefono nulo cuando no se indica ninguno", async () => {
      mockedCreate.mockResolvedValue(customerRecord({ id: "temp-2" }));

      await findOrCreateTemporaryCustomer({ salonId: SALON_ID, firstName: "Ana", lastName: "Perez" });

      expect(mockedCreate).toHaveBeenCalledWith(SALON_ID, expect.objectContaining({ phone: null }));
    });

    it("reporta error generico y captura el error si la creacion falla sin ser telefono duplicado", async () => {
      const failure = new Error("caida");
      mockedCreate.mockRejectedValue(failure);

      const result = await findOrCreateTemporaryCustomer({
        salonId: SALON_ID,
        firstName: "Ana",
        lastName: "Perez",
        phone: "61234567",
      });

      expect(result).toEqual({ ok: false, error: "Error al crear el cliente." });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "customers",
        action: "temporary-create",
      });
    });

    it("no reintenta por duplicado cuando el error de unicidad llega sin telefono", async () => {
      mockedCreate.mockRejectedValue(UNIQUE_VIOLATION);

      const result = await findOrCreateTemporaryCustomer({
        salonId: SALON_ID,
        firstName: "Ana",
        lastName: "Perez",
      });

      expect(result).toEqual({ ok: false, error: "Error al crear el cliente." });
      expect(mockedFindByPhone).not.toHaveBeenCalled();
    });

    it("informa que el telefono ya existe cuando el duplicado no se puede localizar", async () => {
      mockedCreate.mockRejectedValue(UNIQUE_VIOLATION);
      mockedFindByPhone.mockResolvedValue(null);

      const result = await findOrCreateTemporaryCustomer({
        salonId: SALON_ID,
        firstName: "Ana",
        lastName: "Perez",
        phone: "61234567",
      });

      expect(result).toEqual({ ok: false, error: "Ya existe un cliente con ese teléfono." });
      expect(mockedFindByPhone).toHaveBeenCalledWith(SALON_ID, "61234567");
    });

    it("reutiliza el cliente temporal existente actualizando sus nombres", async () => {
      mockedCreate.mockRejectedValue(UNIQUE_VIOLATION);
      mockedFindByPhone.mockResolvedValue(customerRecord({ id: "temp-9", is_temporary: true, is_active: false }));
      mockedUpdate.mockResolvedValue(customerRecord({ id: "temp-9", first_name: "Lu" }));

      const result = await findOrCreateTemporaryCustomer({
        salonId: SALON_ID,
        firstName: " Lu ",
        lastName: "Gomez",
        phone: "61234567",
      });

      expect(result).toEqual({ ok: true, value: "temp-9" });
      expect(mockedUpdate).toHaveBeenCalledWith("temp-9", SALON_ID, {
        first_name: "Lu",
        last_name: "Gomez",
      });
    });

    it("informa error si no se puede actualizar el cliente temporal existente", async () => {
      const failure = new Error("caida");
      mockedCreate.mockRejectedValue(UNIQUE_VIOLATION);
      mockedFindByPhone.mockResolvedValue(customerRecord({ is_temporary: true, is_active: false }));
      mockedUpdate.mockRejectedValue(failure);

      const result = await findOrCreateTemporaryCustomer({
        salonId: SALON_ID,
        firstName: "Ana",
        lastName: "Perez",
        phone: "61234567",
      });

      expect(result).toEqual({ ok: false, error: "Error al actualizar el cliente temporal." });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "customers",
        action: "temporary-update-existing",
      });
    });

    it("bloquea el uso de un cliente archivado (no temporal) con ese telefono", async () => {
      mockedCreate.mockRejectedValue(UNIQUE_VIOLATION);
      mockedFindByPhone.mockResolvedValue(customerRecord({ is_active: false }));

      const result = await findOrCreateTemporaryCustomer({
        salonId: SALON_ID,
        firstName: "Ana",
        lastName: "Perez",
        phone: "61234567",
      });

      expect(result).toEqual({
        ok: false,
        error:
          "Este cliente no esta disponible para nuevas citas. Restauralo desde Clientes para conservar su historial.",
      });
      expect(mockedUpdate).not.toHaveBeenCalled();
    });

    it("usa el cliente permanente activo que ya tiene ese telefono", async () => {
      mockedCreate.mockRejectedValue(UNIQUE_VIOLATION);
      mockedFindByPhone.mockResolvedValue(customerRecord({ id: "perm-1" }));

      expect(
        await findOrCreateTemporaryCustomer({
          salonId: SALON_ID,
          firstName: "Ana",
          lastName: "Perez",
          phone: "61234567",
        })
      ).toEqual({ ok: true, value: "perm-1" });
      expect(mockedUpdate).not.toHaveBeenCalled();
    });
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
