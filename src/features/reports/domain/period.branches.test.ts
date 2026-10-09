import { describe, expect, it } from "vitest";
import {
  availableReportYears,
  getReportPresetRange,
  getYearRange,
  localDateString,
  localYear,
} from "./period";

const PANAMA = "America/Panama";

describe("periodos de reporte (ramas)", () => {
  it("calcula la fecha local en la zona del salon y su año calendario", () => {
    // 02:00 UTC del 1 de julio es aun 30 de junio en Panama (UTC-5).
    const date = new Date("2026-07-01T02:00:00.000Z");

    expect(localDateString(date, PANAMA)).toBe("2026-06-30");
    expect(localDateString(date, "UTC")).toBe("2026-07-01");
    expect(localYear(date, PANAMA)).toBe(2026);
  });

  it("devuelve el rango completo de un año calendario", () => {
    expect(getYearRange(2025)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("lista los años desde el actual hasta el primero con datos, del mas reciente al mas antiguo", () => {
    expect(availableReportYears(2024, 2026)).toEqual([2026, 2025, 2024]);
    expect(availableReportYears(2026, 2026)).toEqual([2026]);
  });

  it("no retrocede mas alla del año actual cuando el primer año con datos es posterior", () => {
    expect(availableReportYears(2027, 2026)).toEqual([2026]);
  });

  describe("getReportPresetRange", () => {
    it("hoy abarca solo la fecha local de hoy", () => {
      expect(getReportPresetRange("hoy", PANAMA, new Date("2026-06-10T15:00:00.000Z"))).toEqual({
        from: "2026-06-10",
        to: "2026-06-10",
      });
    });

    it("semana va de lunes a domingo", () => {
      // Miercoles 10 de junio de 2026.
      expect(getReportPresetRange("semana", PANAMA, new Date("2026-06-10T15:00:00.000Z"))).toEqual({
        from: "2026-06-08",
        to: "2026-06-14",
      });
    });

    it("semana en domingo retrocede hasta el lunes anterior", () => {
      // Domingo 14 de junio de 2026: el lunes de la semana es el 8.
      expect(getReportPresetRange("semana", PANAMA, new Date("2026-06-14T15:00:00.000Z"))).toEqual({
        from: "2026-06-08",
        to: "2026-06-14",
      });
    });

    it("mes va desde el dia 1 hasta hoy", () => {
      expect(getReportPresetRange("mes", PANAMA, new Date("2026-06-10T15:00:00.000Z"))).toEqual({
        from: "2026-06-01",
        to: "2026-06-10",
      });
    });

    it("mes_anterior cubre el mes calendario previo completo", () => {
      expect(getReportPresetRange("mes_anterior", PANAMA, new Date("2026-06-10T15:00:00.000Z"))).toEqual({
        from: "2026-05-01",
        to: "2026-05-31",
      });
    });

    it("mes_anterior desde enero retrocede a diciembre del año previo", () => {
      expect(getReportPresetRange("mes_anterior", PANAMA, new Date("2026-01-15T15:00:00.000Z"))).toEqual({
        from: "2025-12-01",
        to: "2025-12-31",
      });
    });

    it("30dias y 90dias cuentan hacia atras incluyendo el dia de hoy", () => {
      const now = new Date("2026-06-10T15:00:00.000Z");

      expect(getReportPresetRange("30dias", PANAMA, now)).toEqual({ from: "2026-05-12", to: "2026-06-10" });
      expect(getReportPresetRange("90dias", PANAMA, now)).toEqual({ from: "2026-03-13", to: "2026-06-10" });
    });
  });
});
