import { describe, expect, it } from "vitest";
import {
  addDaysToDateISO,
  addMinutes,
  formatLocalDateISO,
  getUtcDayBoundaries,
  getZonedTimeParts,
  timeToMinutes,
  utcBounds,
} from "./dates";

describe("date utilities", () => {
  it("adds minutes without mutating the original date", () => {
    const start = new Date("2026-05-29T15:00:00.000Z");
    const end = addMinutes(start, 45);

    expect(start.toISOString()).toBe("2026-05-29T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-29T15:45:00.000Z");
  });

  it("reads wall-clock parts in the salon timezone", () => {
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
