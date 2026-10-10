import { describe, expect, it } from "vitest";
import { isUniqueConstraintError } from "./errors";

describe("errores de catálogo de servicios", () => {
  describe("isUniqueConstraintError", () => {
    it("reconoce el código 23505 de Postgres aunque no haya mensaje", () => {
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
});
