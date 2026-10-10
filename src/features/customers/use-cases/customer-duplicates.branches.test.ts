import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findCustomerByEmail,
  findCustomerByPhone,
} from "@/features/customers/data/customers.repo";
import type { Database } from "@/types/database.types";
import {
  checkPermanentCustomerByPhone,
  findArchivedCustomerByContact,
  rejectArchivedDuplicate,
} from "./customer-duplicates";

vi.mock("@/features/customers/data/customers.repo", () => ({
  findCustomerByEmail: vi.fn(),
  findCustomerByPhone: vi.fn(),
}));

const mockedFindByEmail = vi.mocked(findCustomerByEmail);
const mockedFindByPhone = vi.mocked(findCustomerByPhone);

const SALON_ID = "salon-1";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

const baseCustomer: CustomerRow = {
  id: "cust-1",
  salon_id: SALON_ID,
  first_name: "Ana",
  last_name: "Perez",
  phone: "61234567",
  email: "ana@example.com",
  birth_date: null,
  notes: "",
  is_temporary: false,
  is_active: true,
  search_name: "perez ana",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

function customer(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return { ...baseCustomer, ...overrides };
}

describe("customer-duplicates (ramas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindByPhone.mockResolvedValue(null);
    mockedFindByEmail.mockResolvedValue(null);
  });

  describe("checkPermanentCustomerByPhone", () => {
    it("no consulta cuando el teléfono normalizado queda vacio", async () => {
      expect(await checkPermanentCustomerByPhone(SALON_ID, "abc")).toEqual({ exists: false });
      expect(mockedFindByPhone).not.toHaveBeenCalled();
    });

    it("busca el teléfono normalizado dentro del salón", async () => {
      await checkPermanentCustomerByPhone(SALON_ID, "+507 6123-4567");

      expect(mockedFindByPhone).toHaveBeenCalledWith(SALON_ID, "61234567");
    });

    it("no existe cuando no hay cliente o el registro es temporal", async () => {
      expect(await checkPermanentCustomerByPhone(SALON_ID, "61234567")).toEqual({ exists: false });

      mockedFindByPhone.mockResolvedValue(customer({ is_temporary: true, is_active: false }));
      expect(await checkPermanentCustomerByPhone(SALON_ID, "61234567")).toEqual({ exists: false });
    });

    it("existe y no esta archivado cuando el cliente permanente está activo", async () => {
      mockedFindByPhone.mockResolvedValue(customer());

      expect(await checkPermanentCustomerByPhone(SALON_ID, "61234567")).toEqual({
        exists: true,
        archived: false,
      });
    });

    it("existe y esta archivado cuando el cliente permanente está inactivo", async () => {
      mockedFindByPhone.mockResolvedValue(customer({ is_active: false }));

      expect(await checkPermanentCustomerByPhone(SALON_ID, "61234567")).toEqual({
        exists: true,
        archived: true,
      });
    });
  });

  describe("findArchivedCustomerByContact", () => {
    it("devuelve null sin consultar cuando no hay teléfono ni correo", async () => {
      expect(await findArchivedCustomerByContact(SALON_ID)).toBeNull();
      expect(await findArchivedCustomerByContact(SALON_ID, "", "   ")).toBeNull();
      expect(mockedFindByPhone).not.toHaveBeenCalled();
      expect(mockedFindByEmail).not.toHaveBeenCalled();
    });

    it("encuentra un archivado por teléfono y devuelve su identidad con nombre recortado", async () => {
      mockedFindByPhone.mockResolvedValue(
        customer({ id: "arch-1", first_name: "Ana ", last_name: "", is_active: false })
      );

      expect(await findArchivedCustomerByContact(SALON_ID, "+507 6123 4567")).toEqual({
        id: "arch-1",
        name: "Ana",
        phone: "61234567",
        email: "ana@example.com",
      });
      expect(mockedFindByPhone).toHaveBeenCalledWith(SALON_ID, "61234567");
      expect(mockedFindByEmail).toHaveBeenCalledTimes(0);
    });

    it("busca por correo recortado cuando no se indica teléfono", async () => {
      mockedFindByEmail.mockResolvedValue(customer({ id: "arch-2", is_active: false }));

      const match = await findArchivedCustomerByContact(SALON_ID, undefined, "  ana@example.com ");

      expect(match?.id).toBe("arch-2");
      expect(mockedFindByEmail).toHaveBeenCalledWith(SALON_ID, "ana@example.com");
      expect(mockedFindByPhone).not.toHaveBeenCalled();
    });

    it("ignora coincidencias activas o temporales aunque coincidan por contacto", async () => {
      mockedFindByPhone.mockResolvedValue(customer({ is_active: true }));
      mockedFindByEmail.mockResolvedValue(customer({ is_active: false, is_temporary: true }));

      expect(await findArchivedCustomerByContact(SALON_ID, "61234567", "ana@example.com")).toBeNull();
    });

    it("prefiere el archivado por correo cuando el teléfono coincide con un cliente activo", async () => {
      mockedFindByPhone.mockResolvedValue(customer({ id: "activo", is_active: true }));
      mockedFindByEmail.mockResolvedValue(customer({ id: "archivado", is_active: false }));

      expect((await findArchivedCustomerByContact(SALON_ID, "61234567", "ana@example.com"))?.id).toBe(
        "archivado"
      );
    });
  });

  describe("rejectArchivedDuplicate", () => {
    it("permite el alta cuando no hay duplicado archivado", async () => {
      expect(await rejectArchivedDuplicate(SALON_ID, { phone: "61234567", email: null })).toEqual({
        ok: true,
        value: undefined,
      });
    });

    it("bloquea el alta y pide restaurar el cliente archivado existente", async () => {
      mockedFindByPhone.mockResolvedValue(customer({ is_active: false }));

      expect(await rejectArchivedDuplicate(SALON_ID, { phone: "61234567", email: undefined })).toEqual({
        ok: false,
        error: "Ya existe un cliente con esos datos. Restauralo para conservar su historial.",
      });
    });

    it("usa el correo como criterio cuando el alta no trae teléfono", async () => {
      mockedFindByEmail.mockResolvedValue(customer({ is_active: false }));

      const result = await rejectArchivedDuplicate(SALON_ID, { phone: null, email: "ana@example.com" });

      expect(result.ok).toBe(false);
      expect(mockedFindByEmail).toHaveBeenCalledWith(SALON_ID, "ana@example.com");
    });
  });
});
