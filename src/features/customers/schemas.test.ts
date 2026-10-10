import { describe, expect, it } from "vitest";
import {
  ArchivedCustomerLookupSchema,
  CreateCustomerSchema,
  CustomerPhoneLookupSchema,
  UpdateCustomerSchema,
} from "./schemas";

const validCustomer = {
  first_name: "Ana",
  last_name: "Perez",
};

describe("customers schemas", () => {
  describe("CreateCustomerSchema", () => {
    it("aplica valores por defecto para notas y clientes permanentes", () => {
      const parsed = CreateCustomerSchema.parse(validCustomer);

      expect(parsed).toEqual({
        first_name: "Ana",
        last_name: "Perez",
        notes: "",
        is_temporary: false,
      });
    });

    it("exige nombre y apellido no vacios", () => {
      const result = CreateCustomerSchema.safeParse({ first_name: "", last_name: "" });

      expect(result.success).toBe(false);
      const messages = result.error?.issues.map((issue) => issue.message) ?? [];
      expect(messages).toEqual(["El nombre es obligatorio", "El apellido es obligatorio"]);
    });

    it("limita la longitud de nombres a 100 caracteres", () => {
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, first_name: "a".repeat(100) }).success).toBe(true);
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, first_name: "a".repeat(101) }).success).toBe(false);
    });

    it("acepta teléfono opcional de celular panameno y rechaza el que no cumple", () => {
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, phone: "6123-4567" }).success).toBe(true);
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, phone: null }).success).toBe(true);

      const invalid = CreateCustomerSchema.safeParse({ ...validCustomer, phone: "2123-4567" });
      expect(invalid.success).toBe(false);
      expect(invalid.error?.issues[0]?.message).toBe("El celular debe tener 8 digitos y comenzar con 6.");
    });

    it("válida el formato del correo y permite omitirlo", () => {
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, email: "ana@example.com" }).success).toBe(true);
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, email: null }).success).toBe(true);

      const invalid = CreateCustomerSchema.safeParse({ ...validCustomer, email: "no-es-correo" });
      expect(invalid.error?.issues[0]?.message).toBe("Email inválido");
    });

    it("acepta fecha de nacimiento ISO real y rechaza fechas imposibles", () => {
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, birth_date: "1990-02-28" }).success).toBe(true);
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, birth_date: "1990-02-30" }).success).toBe(false);
    });

    it("limita las notas a 2000 caracteres", () => {
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, notes: "n".repeat(2000) }).success).toBe(true);
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, notes: "n".repeat(2001) }).success).toBe(false);
    });
  });

  describe("UpdateCustomerSchema", () => {
    // Regresión F02-3: archivar/reactivar y convertir temporal solo pasan por sus casos de uso.
    it("descarta is_active e is_temporary de una edición normal", () => {
      expect(UpdateCustomerSchema.parse({ is_active: false, is_temporary: true })).toEqual({});
    });

    // Una edición parcial no debe reescribir notes ni is_temporary.
    it("una actualización parcial solo devuelve los campos enviados", () => {
      expect(UpdateCustomerSchema.parse({ notes: "Alergia", is_active: false })).toEqual({ notes: "Alergia" });
    });

    it("sigue validando los campos que se envian", () => {
      expect(UpdateCustomerSchema.safeParse({ first_name: "" }).success).toBe(false);
      expect(UpdateCustomerSchema.safeParse({ phone: "2123-4567" }).success).toBe(false);
    });
  });

  describe("CustomerPhoneLookupSchema", () => {
    it("acepta un celular panameño válido y rechaza uno que no cumple", () => {
      expect(CustomerPhoneLookupSchema.safeParse("61234567").success).toBe(true);
      expect(CustomerPhoneLookupSchema.safeParse("").success).toBe(false);
      expect(CustomerPhoneLookupSchema.safeParse("2123-4567").success).toBe(false);
      expect(CustomerPhoneLookupSchema.safeParse("6".repeat(31)).success).toBe(false);
    });
  });

  describe("ArchivedCustomerLookupSchema", () => {
    it("permite buscar solo por teléfono, solo por email o sin datos", () => {
      expect(ArchivedCustomerLookupSchema.safeParse({ phone: "61234567" }).success).toBe(true);
      expect(ArchivedCustomerLookupSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
      expect(ArchivedCustomerLookupSchema.safeParse({ phone: "", email: "" }).success).toBe(true);
      expect(ArchivedCustomerLookupSchema.safeParse({}).success).toBe(true);
    });

    it("rechaza un teléfono o email con formato inválido", () => {
      expect(ArchivedCustomerLookupSchema.safeParse({ phone: "2123-4567" }).success).toBe(false);
      expect(ArchivedCustomerLookupSchema.safeParse({ email: "no-es-correo" }).success).toBe(false);
    });
  });

});
