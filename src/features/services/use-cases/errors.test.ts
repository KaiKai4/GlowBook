import { describe, expect, it } from "vitest";
import { isCategoryOwnershipError, isUniqueConstraintError } from "./errors";

describe("errores de catalogo de servicios", () => {
  describe("isUniqueConstraintError", () => {
    it("reconoce el codigo 23505 de Postgres aunque no haya mensaje", () => {
      expect(isUniqueConstraintError({ code: "23505" })).toBe(true);
    });

    it("reconoce violaciones de unicidad por mensaje sin distinguir mayusculas", () => {
      expect(isUniqueConstraintError(new Error("Duplicate key"))).toBe(true);
      expect(isUniqueConstraintError(new Error("UNIQUE constraint failed"))).toBe(true);
    });

    it("no confunde otros errores ni valores no-error con unicidad", () => {
      expect(isUniqueConstraintError(new Error("caida de red"))).toBe(false);
      expect(isUniqueConstraintError({ code: "42703" })).toBe(false);
      expect(isUniqueConstraintError(null)).toBe(false);
      expect(isUniqueConstraintError("duplicate")).toBe(false);
    });
  });

  describe("isCategoryOwnershipError", () => {
    it.each([
      "La categoria no existe",
      "La categoría no pertenece al salón.",
      "la categoría está inactiva",
      "No pertenece a este salon",
    ])("detecta el mensaje de propiedad de categoria: %s", (message) => {
      expect(isCategoryOwnershipError(new Error(message))).toBe(true);
    });

    it("ignora otros errores y valores que no son Error", () => {
      expect(isCategoryOwnershipError(new Error("Servicio duplicado"))).toBe(false);
      expect(isCategoryOwnershipError({ message: "categoria" })).toBe(false);
      expect(isCategoryOwnershipError(undefined)).toBe(false);
    });
  });
});
