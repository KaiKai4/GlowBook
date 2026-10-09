import { describe, expect, it } from "vitest";
import { CreateCustomerSchema, UpdateCustomerSchema } from "./schemas";

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

    it("acepta telefono opcional de celular panameno y rechaza el que no cumple", () => {
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, phone: "6123-4567" }).success).toBe(true);
      expect(CreateCustomerSchema.safeParse({ ...validCustomer, phone: null }).success).toBe(true);

      const invalid = CreateCustomerSchema.safeParse({ ...validCustomer, phone: "2123-4567" });
      expect(invalid.success).toBe(false);
      expect(invalid.error?.issues[0]?.message).toBe("El celular debe tener 8 digitos y comenzar con 6.");
    });

    it("valida el formato del correo y permite omitirlo", () => {
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
    it("acepta el estado activo en una actualizacion parcial", () => {
      expect(UpdateCustomerSchema.parse({ is_active: false })).toMatchObject({ is_active: false });
    });

    // Regresión: una edición parcial no debe reescribir notes ni is_temporary.
    it("una actualizacion parcial no rellena notes ni is_temporary", () => {
      expect(UpdateCustomerSchema.parse({ is_active: false })).toEqual({ is_active: false });
    });

    it("sigue validando los campos que se envian", () => {
      expect(UpdateCustomerSchema.safeParse({ first_name: "" }).success).toBe(false);
      expect(UpdateCustomerSchema.safeParse({ is_active: "si" }).success).toBe(false);
    });
  });
});
