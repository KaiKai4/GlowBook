import { describe, expect, it } from "vitest";
import { parseReportFilters } from "./schemas";

describe("parseReportFilters", () => {
  it("usa el preset por defecto 'mes' cuando la consulta está vacía o es inválida", () => {
    expect(parseReportFilters(undefined)).toEqual({ preset: "mes" });
    expect(parseReportFilters({ preset: "trimestre" })).toEqual({ preset: "mes" });
    expect(parseReportFilters("no-es-objeto")).toEqual({ preset: "mes" });
  });

  it("acepta un preset válido sin rango personalizado", () => {
    expect(parseReportFilters({ preset: "90dias" })).toEqual({ preset: "90dias" });
  });

  it("conserva el rango personalizado cuando las fechas son válidas y ordenadas", () => {
    // "custom" no es un preset del schema: el rango se valida por sí solo.
    expect(parseReportFilters({ from: "2026-01-01", to: "2026-01-31" })).toEqual({
      preset: "mes",
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("descarta el rango si la fecha de inicio es posterior a la de fin", () => {
    expect(parseReportFilters({ preset: "semana", from: "2026-02-10", to: "2026-02-01" })).toEqual({
      preset: "semana",
    });
  });

  it("descarta el rango si falta una de las fechas o no tiene formato de fecha", () => {
    expect(parseReportFilters({ from: "2026-01-01" })).toEqual({ preset: "mes" });
    expect(parseReportFilters({ from: "01/01/2026", to: "31/01/2026" })).toEqual({ preset: "mes" });
  });
});
