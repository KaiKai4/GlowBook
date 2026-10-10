import { formatLocalDateISO } from "@/infra/format/dates";
import { describe, expect, it } from "vitest";
import {
  availableReportYears,
  getReportPresetRange,
  getYearRange,
  localYear,
} from "./period";

describe("report period", () => {
  it("formats local dates in the requested timezone", () => {
    const date = new Date("2030-01-02T04:30:00.000Z");

    expect(formatLocalDateISO(date, "America/Panama")).toBe("2030-01-01");
    expect(formatLocalDateISO(date, "UTC")).toBe("2030-01-02");
  });

  it("uses the salon-local day for today and current month presets", () => {
    const now = new Date("2030-03-15T03:30:00.000Z");

    expect(getReportPresetRange("hoy", "America/Panama", now)).toEqual({
      from: "2030-03-14",
      to: "2030-03-14",
    });
    expect(getReportPresetRange("mes", "America/Panama", now)).toEqual({
      from: "2030-03-01",
      to: "2030-03-14",
    });
  });

  it("returns Monday through Sunday for the weekly preset", () => {
    const now = new Date("2030-05-15T12:00:00.000Z");

    expect(getReportPresetRange("semana", "UTC", now)).toEqual({
      from: "2030-05-13",
      to: "2030-05-19",
    });
  });

  it("handles previous-month ranges across year boundaries", () => {
    const now = new Date("2030-01-10T12:00:00.000Z");

    expect(getReportPresetRange("mes_anterior", "UTC", now)).toEqual({
      from: "2029-12-01",
      to: "2029-12-31",
    });
  });

  it("returns inclusive rolling windows for 30 and 90 day presets", () => {
    const now = new Date("2030-06-30T12:00:00.000Z");

    expect(getReportPresetRange("30dias", "UTC", now)).toEqual({
      from: "2030-06-01",
      to: "2030-06-30",
    });
    expect(getReportPresetRange("90dias", "UTC", now)).toEqual({
      from: "2030-04-02",
      to: "2030-06-30",
    });
  });

  it("derives the local calendar year of a date", () => {
    // 1 de enero 00:30 UTC todavía es 31 de diciembre del año anterior en Panamá.
    const date = new Date("2027-01-01T00:30:00.000Z");

    expect(localYear(date, "UTC")).toBe(2027);
    expect(localYear(date, "America/Panama")).toBe(2026);
  });

  it("spans a full calendar year for the annual accumulator", () => {
    expect(getYearRange(2026)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("lists years from the current one back to the salón's first year", () => {
    expect(availableReportYears(2024, 2026)).toEqual([2026, 2025, 2024]);
    expect(availableReportYears(2026, 2026)).toEqual([2026]);
    // Si el dato más antiguo fuera posterior al año actual (reloj raro), no rompe.
    expect(availableReportYears(2030, 2026)).toEqual([2026]);
  });
});
