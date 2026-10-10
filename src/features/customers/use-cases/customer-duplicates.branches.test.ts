import { describe, expect, it, vi, type Mock } from "vitest";
import type { DuplicateCandidate } from "@/features/customers/domain/duplicates";
import {
  checkPermanentCustomerByPhone,
  findArchivedCustomerByContact,
  rejectArchivedDuplicate,
  type CustomerDuplicatesDeps,
} from "./customer-duplicates";

const SALON_ID = "salon-1";

const baseCustomer: DuplicateCandidate = {
  id: "cust-1",
  first_name: "Ana",
  last_name: "Perez",
  phone: "61234567",
  email: "ana@example.com",
  is_temporary: false,
  is_active: true,
};

function customer(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return { ...baseCustomer, ...overrides };
}

/** Fakes tipados con vi.fn: por defecto no hay coincidencias. */
function makeDeps(): {
  deps: CustomerDuplicatesDeps;
  findByPhone: Mock<CustomerDuplicatesDeps["findCustomerByPhone"]>;
  findByEmail: Mock<CustomerDuplicatesDeps["findCustomerByEmail"]>;
} {
  const findByPhone = vi.fn<CustomerDuplicatesDeps["findCustomerByPhone"]>(async () => null);
  const findByEmail = vi.fn<CustomerDuplicatesDeps["findCustomerByEmail"]>(async () => null);
  return { deps: { findCustomerByPhone: findByPhone, findCustomerByEmail: findByEmail }, findByPhone, findByEmail };
}

describe("customer-duplicates (ramas)", () => {
  describe("checkPermanentCustomerByPhone", () => {
    it("no consulta cuando el teléfono normalizado queda vacio", async () => {
      const { deps, findByPhone } = makeDeps();

      expect(await checkPermanentCustomerByPhone(SALON_ID, "abc", deps)).toEqual({ exists: false });
      expect(findByPhone).not.toHaveBeenCalled();
    });

    it("busca el teléfono normalizado dentro del salón", async () => {
      const { deps, findByPhone } = makeDeps();

      await checkPermanentCustomerByPhone(SALON_ID, "+507 6123-4567", deps);

      expect(findByPhone).toHaveBeenCalledWith(SALON_ID, "61234567");
    });

    it("no existe cuando no hay cliente o el registro es temporal", async () => {
      const { deps, findByPhone } = makeDeps();
      expect(await checkPermanentCustomerByPhone(SALON_ID, "61234567", deps)).toEqual({ exists: false });

      findByPhone.mockResolvedValue(customer({ is_temporary: true, is_active: false }));
      expect(await checkPermanentCustomerByPhone(SALON_ID, "61234567", deps)).toEqual({ exists: false });
    });

    it("existe y no esta archivado cuando el cliente permanente está activo", async () => {
      const { deps, findByPhone } = makeDeps();
      findByPhone.mockResolvedValue(customer());

      expect(await checkPermanentCustomerByPhone(SALON_ID, "61234567", deps)).toEqual({
        exists: true,
        archived: false,
      });
    });

    it("existe y esta archivado cuando el cliente permanente está inactivo", async () => {
      const { deps, findByPhone } = makeDeps();
      findByPhone.mockResolvedValue(customer({ is_active: false }));

      expect(await checkPermanentCustomerByPhone(SALON_ID, "61234567", deps)).toEqual({
        exists: true,
        archived: true,
      });
    });
  });

  describe("findArchivedCustomerByContact", () => {
    it("devuelve null sin consultar cuando no hay teléfono ni correo", async () => {
      const { deps, findByPhone, findByEmail } = makeDeps();

      expect(await findArchivedCustomerByContact(SALON_ID, undefined, undefined, deps)).toBeNull();
      expect(await findArchivedCustomerByContact(SALON_ID, "", "   ", deps)).toBeNull();
      expect(findByPhone).not.toHaveBeenCalled();
      expect(findByEmail).not.toHaveBeenCalled();
    });

    it("encuentra un archivado por teléfono y devuelve su identidad con nombre recortado", async () => {
      const { deps, findByPhone, findByEmail } = makeDeps();
      findByPhone.mockResolvedValue(
        customer({ id: "arch-1", first_name: "Ana ", last_name: "", is_active: false })
      );

      expect(await findArchivedCustomerByContact(SALON_ID, "+507 6123 4567", undefined, deps)).toEqual({
        id: "arch-1",
        name: "Ana",
        phone: "61234567",
        email: "ana@example.com",
      });
      expect(findByPhone).toHaveBeenCalledWith(SALON_ID, "61234567");
      expect(findByEmail).toHaveBeenCalledTimes(0);
    });

    it("busca por correo recortado cuando no se indica teléfono", async () => {
      const { deps, findByPhone, findByEmail } = makeDeps();
      findByEmail.mockResolvedValue(customer({ id: "arch-2", is_active: false }));

      const match = await findArchivedCustomerByContact(SALON_ID, undefined, "  ana@example.com ", deps);

      expect(match?.id).toBe("arch-2");
      expect(findByEmail).toHaveBeenCalledWith(SALON_ID, "ana@example.com");
      expect(findByPhone).not.toHaveBeenCalled();
    });

    it("ignora coincidencias activas o temporales aunque coincidan por contacto", async () => {
      const { deps, findByPhone, findByEmail } = makeDeps();
      findByPhone.mockResolvedValue(customer({ is_active: true }));
      findByEmail.mockResolvedValue(customer({ is_active: false, is_temporary: true }));

      expect(
        await findArchivedCustomerByContact(SALON_ID, "61234567", "ana@example.com", deps)
      ).toBeNull();
    });

    it("prefiere el archivado por correo cuando el teléfono coincide con un cliente activo", async () => {
      const { deps, findByPhone, findByEmail } = makeDeps();
      findByPhone.mockResolvedValue(customer({ id: "activo", is_active: true }));
      findByEmail.mockResolvedValue(customer({ id: "archivado", is_active: false }));

      expect(
        (await findArchivedCustomerByContact(SALON_ID, "61234567", "ana@example.com", deps))?.id
      ).toBe("archivado");
    });
  });

  describe("rejectArchivedDuplicate", () => {
    it("permite el alta cuando no hay duplicado archivado", async () => {
      const { deps } = makeDeps();

      expect(await rejectArchivedDuplicate(SALON_ID, { phone: "61234567", email: null }, deps)).toEqual({
        ok: true,
        value: undefined,
      });
    });

    it("bloquea el alta y pide restaurar el cliente archivado existente", async () => {
      const { deps, findByPhone } = makeDeps();
      findByPhone.mockResolvedValue(customer({ is_active: false }));

      expect(
        await rejectArchivedDuplicate(SALON_ID, { phone: "61234567", email: undefined }, deps)
      ).toEqual({
        ok: false,
        error: "Ya existe un cliente con esos datos. Restauralo para conservar su historial.",
      });
    });

    it("usa el correo como criterio cuando el alta no trae teléfono", async () => {
      const { deps, findByEmail } = makeDeps();
      findByEmail.mockResolvedValue(customer({ is_active: false }));

      const result = await rejectArchivedDuplicate(
        SALON_ID,
        { phone: null, email: "ana@example.com" },
        deps
      );

      expect(result.ok).toBe(false);
      expect(findByEmail).toHaveBeenCalledWith(SALON_ID, "ana@example.com");
    });
  });
});
