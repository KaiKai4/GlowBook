import { describe, expect, it } from "vitest";
import {
  CreateCategorySchema,
  CreateServiceSchema,
  UpdateCategorySchema,
  UpdateServiceSchema,
} from "./schemas";

const VALID_CATEGORY_ID = "00000000-0000-4000-8000-000000000011";

const validService = {
  category_id: VALID_CATEGORY_ID,
  name: "Corte",
  duration_minutes: 30,
  price: 12.5,
};

describe("services schemas", () => {
  describe("CreateCategorySchema", () => {
    it("aplica valores por defecto: descripcion vacia, orden 0 y precio fijo", () => {
      expect(CreateCategorySchema.parse({ name: "Corte" })).toEqual({
        name: "Corte",
        description: "",
        ordering: 0,
        pricing_mode: "fixed",
      });
    });

    it("exige nombre no vacio de maximo 100 caracteres", () => {
      expect(CreateCategorySchema.safeParse({ name: "" }).success).toBe(false);
      expect(CreateCategorySchema.safeParse({ name: "a".repeat(100) }).success).toBe(true);
      expect(CreateCategorySchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
    });

    it("acepta solo orden entero no negativo y modos de precio conocidos", () => {
      expect(CreateCategorySchema.safeParse({ name: "A", ordering: -1 }).success).toBe(false);
      expect(CreateCategorySchema.safeParse({ name: "A", ordering: 1.5 }).success).toBe(false);
      expect(CreateCategorySchema.safeParse({ name: "A", pricing_mode: "variable" }).success).toBe(true);
      expect(CreateCategorySchema.safeParse({ name: "A", pricing_mode: "mixto" }).success).toBe(false);
    });
  });

  describe("UpdateCategorySchema", () => {
    it("valida los campos que llegan y conserva el estado activo", () => {
      expect(UpdateCategorySchema.safeParse({ name: "" }).success).toBe(false);
      expect(UpdateCategorySchema.safeParse({ is_active: true }).success).toBe(true);
    });

    // CONDUCTA ACTUAL (posible bug): la version parcial conserva los defaults de
    // CreateCategorySchema (services/schemas.ts:7-9). Cambiar solo el modo de
    // precio (services/actions.ts:86) reescribe description = "" y ordering = 0.
    it("CONDUCTA ACTUAL (posible bug): una actualizacion parcial rellena description, ordering y pricing_mode", () => {
      expect(UpdateCategorySchema.parse({ pricing_mode: "variable" })).toEqual({
        description: "",
        ordering: 0,
        pricing_mode: "variable",
      });
    });
  });

  describe("CreateServiceSchema", () => {
    it("acepta un servicio valido con descripcion por defecto vacia", () => {
      expect(CreateServiceSchema.parse(validService)).toEqual({ ...validService, description: "" });
    });

    it("exige una categoria con formato uuid", () => {
      const result = CreateServiceSchema.safeParse({ ...validService, category_id: "no-uuid" });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Categoría inválida");
    });

    it("exige duracion entera de al menos un minuto", () => {
      const zero = CreateServiceSchema.safeParse({ ...validService, duration_minutes: 0 });
      expect(zero.error?.issues[0]?.message).toBe("La duración debe ser al menos 1 minuto");

      expect(CreateServiceSchema.safeParse({ ...validService, duration_minutes: 2.5 }).success).toBe(false);
    });

    it("no permite precios negativos y acepta precio cero", () => {
      expect(CreateServiceSchema.safeParse({ ...validService, price: 0 }).success).toBe(true);

      const negative = CreateServiceSchema.safeParse({ ...validService, price: -1 });
      expect(negative.error?.issues[0]?.message).toBe("El precio no puede ser negativo");
    });

    it("limita la descripcion a 500 caracteres", () => {
      expect(CreateServiceSchema.safeParse({ ...validService, description: "d".repeat(500) }).success).toBe(true);
      expect(CreateServiceSchema.safeParse({ ...validService, description: "d".repeat(501) }).success).toBe(false);
    });
  });

  describe("UpdateServiceSchema", () => {
    it("valida los campos que llegan y conserva el estado activo", () => {
      expect(UpdateServiceSchema.safeParse({ duration_minutes: 0 }).success).toBe(false);
      expect(UpdateServiceSchema.parse({ is_active: true })).toMatchObject({ is_active: true });
    });

    // CONDUCTA ACTUAL (posible bug): la version parcial de servicios conserva el
    // default de description (services/schemas.ts:19); una edicion de precio
    // sobrescribe la descripcion con cadena vacia.
    it("CONDUCTA ACTUAL (posible bug): una actualizacion parcial rellena description", () => {
      expect(UpdateServiceSchema.parse({ price: 20 })).toEqual({ price: 20, description: "" });
    });
  });
});
