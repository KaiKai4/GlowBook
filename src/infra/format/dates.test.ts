import { describe, expect, it } from "vitest";
import {
  addDaysToDateISO,
  addMinutes,
  formatLocalDateISO,
  getUtcDayBoundaries,
  getZonedTimeParts,
  noonProbeForLocalDate,
  timeToMinutes,
  utcBounds,
  zonedWallTimeToUtc,
} from "./dates";

describe("date utilities", () => {
  it("adds minutes without mutating the original date", () => {
    const start = new Date("2026-05-29T15:00:00.000Z");
    const end = addMinutes(start, 45);

    expect(start.toISOString()).toBe("2026-05-29T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-29T15:45:00.000Z");
  });

  it("reads wall-clock parts in the salón timezone", () => {
    expect(getZonedTimeParts(new Date("2026-05-28T15:30:00.000Z"), "America/Panama")).toEqual({
      dayOfWeek: 3,
      minutesOfDay: 10 * 60 + 30,
    });
  });

  it("formats local dates around UTC midnight", () => {
    const instant = new Date("2026-05-29T04:30:00.000Z");

    expect(formatLocalDateISO(instant, "America/Panama")).toBe("2026-05-28");
    expect(formatLocalDateISO(instant, "UTC")).toBe("2026-05-29");
  });

  it("creates UTC bounds for a local Panama day", () => {
    expect(utcBounds("2026-05-28", "2026-05-28", "America/Panama")).toEqual({
      start: "2026-05-28T05:00:00.000Z",
      end: "2026-05-29T04:59:59.999Z",
    });
  });

  it("returns UTC day boundaries for a timezone-aware date", () => {
    const { start, end } = getUtcDayBoundaries(
      new Date("2026-05-29T04:30:00.000Z"),
      "America/Panama"
    );

    expect(start.toISOString()).toBe("2026-05-28T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-29T04:59:59.999Z");
  });

  it("handles ISO date arithmetic and time parsing", () => {
    expect(addDaysToDateISO("2026-01-31", 1)).toBe("2026-02-01");
    expect(timeToMinutes("09:45")).toBe(585);
  });
});

describe("zonedWallTimeToUtc", () => {
  it("interprets the wall-clock time in the salon timezone (fixed offset)", () => {
    expect(zonedWallTimeToUtc("2026-07-15", "09:00", "America/Panama").toISOString())
      .toBe("2026-07-15T14:00:00.000Z");
  });

  it("applies daylight saving offsets for the salón date", () => {
    expect(zonedWallTimeToUtc("2026-07-15", "09:00", "Europe/Madrid").toISOString())
      .toBe("2026-07-15T07:00:00.000Z");
    expect(zonedWallTimeToUtc("2026-01-15", "09:00", "Europe/Madrid").toISOString())
      .toBe("2026-01-15T08:00:00.000Z");
  });

  it("does not depend on the process/browser local timezone", () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = "Asia/Tokyo";
      expect(zonedWallTimeToUtc("2026-07-15", "09:00", "America/Panama").toISOString())
        .toBe("2026-07-15T14:00:00.000Z");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});

describe("noonProbeForLocalDate y límites del día", () => {
  it("no desplaza la sonda en UTC-12 (el mediodía UTC sigue en el mismo día local)", () => {
    const probe = noonProbeForLocalDate("2026-05-28", "Etc/GMT+12");
    expect(probe.toISOString()).toBe("2026-05-28T12:00:00.000Z");

    const { start, end } = getUtcDayBoundaries(probe, "Etc/GMT+12");
    expect(start.toISOString()).toBe("2026-05-28T12:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-29T11:59:59.999Z");
  });

  it("retrasa 12 h la sonda en UTC+14 para no caer en el día siguiente", () => {
    const probe = noonProbeForLocalDate("2026-05-28", "Pacific/Kiritimati");
    expect(probe.toISOString()).toBe("2026-05-28T00:00:00.000Z");

    const { start, end } = getUtcDayBoundaries(probe, "Pacific/Kiritimati");
    expect(start.toISOString()).toBe("2026-05-27T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-28T09:59:59.999Z");
  });

  it("cubre un día de 23 h al entrar en horario de verano (America/New_York 2026-03-08)", () => {
    const probe = noonProbeForLocalDate("2026-03-08", "America/New_York");
    const { start, end } = getUtcDayBoundaries(probe, "America/New_York");
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T03:59:59.999Z");
  });

  it("cubre un día de 25 h al salir de horario de verano (America/New_York 2026-11-01)", () => {
    const probe = noonProbeForLocalDate("2026-11-01", "America/New_York");
    const { start, end } = getUtcDayBoundaries(probe, "America/New_York");
    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T04:59:59.999Z");
  });
});
