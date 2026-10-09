import { describe, expect, it } from "vitest";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  expenseDisplayLabel,
} from "./categories";

describe("catalogo de categorias de gasto", () => {
  it("tiene una etiqueta en espanol para cada categoria del catalogo", () => {
    for (const category of EXPENSE_CATEGORIES) {
      expect(EXPENSE_CATEGORY_LABELS[category]).toEqual(expect.any(String));
      expect(EXPENSE_CATEGORY_LABELS[category].length).toBeGreaterThan(0);
    }
    expect(EXPENSE_CATEGORY_LABELS.products).toBe("Productos e insumos");
  });

  describe("expenseDisplayLabel", () => {
    it("usa la etiqueta del catalogo para categorias distintas de 'other', ignorando texto libre", () => {
      expect(expenseDisplayLabel("rent", "texto ajeno")).toBe("Alquiler");
      expect(expenseDisplayLabel("tools", null)).toBe("Herramientas y equipo");
    });

    it("muestra el texto libre de 'other' sin espacios sobrantes", () => {
      expect(expenseDisplayLabel("other", "  Regalos de temporada  ")).toBe("Regalos de temporada");
    });

    it("cae a la etiqueta generica de 'other' cuando el texto libre falta o solo tiene espacios", () => {
      expect(expenseDisplayLabel("other", null)).toBe("Otro");
      expect(expenseDisplayLabel("other", undefined)).toBe("Otro");
      expect(expenseDisplayLabel("other", "   ")).toBe("Otro");
      expect(expenseDisplayLabel("other", "")).toBe("Otro");
    });
  });
});
