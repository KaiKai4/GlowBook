import { describe, expect, it } from "vitest";
import { expenseSources, monthLabel, monthRange, selectedMonth, yearQueryParam } from "./report-presentation";

describe("selectedMonth", () => {
  it("toma el año y mes de una fecha ISO", () => {
    expect(selectedMonth("2026-10-01")).toBe("2026-10");
  });
});

describe("monthRange", () => {
  it("devuelve el primer y ultimo dia del mes", () => {
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("respeta los años bisiestos en febrero", () => {
    expect(monthRange("2028-02").to).toBe("2028-02-29");
    expect(monthRange("2026-02").to).toBe("2026-02-28");
  });
});

describe("monthLabel", () => {
  it("nombra el mes en español con su año", () => {
    expect(monthLabel("2026-10")).toMatch(/octubre de 2026/i);
  });
});

describe("yearQueryParam", () => {
  it("omite el año en curso para mantener la URL limpia", () => {
    expect(yearQueryParam(2026, 2026)).toBeUndefined();
  });

  it("conserva los años anteriores", () => {
    expect(yearQueryParam(2025, 2026)).toBe(2025);
  });
});

describe("expenseSources", () => {
  it("describe las fuentes de egreso activas", () => {
    expect(expenseSources({ expenses: true, inventory: true })).toBe("Gastos y reposiciones");
    expect(expenseSources({ expenses: true, inventory: false })).toBe("Gastos operativos");
    expect(expenseSources({ expenses: false, inventory: true })).toBe("Reposiciones");
    expect(expenseSources({ expenses: false, inventory: false })).toBe("Sin módulos de egresos");
  });
});
