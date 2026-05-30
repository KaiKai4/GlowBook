import { describe, expect, it } from "vitest";
import { getReportPresetRange, localDateString } from "./period";

describe("report period", () => {
  it("formats local dates in the requested timezone", () => {
    const date = new Date("2030-01-02T04:30:00.000Z");

    expect(localDateString(date, "America/Panama")).toBe("2030-01-01");
    expect(localDateString(date, "UTC")).toBe("2030-01-02");
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
});
