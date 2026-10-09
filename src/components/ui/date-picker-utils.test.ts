import { describe, expect, it } from "vitest";
import {
  getCalendarDays,
  getYearBlock,
  shiftCalendarView,
  toDateValue,
} from "./date-picker-utils";

describe("date picker calendar", () => {
  it("builds a Monday-first grid with complete weeks", () => {
    const days = getCalendarDays(new Date(2026, 4, 15));

    expect(days).toHaveLength(42);
    expect(days[0]?.getDay()).toBe(1);
    expect(days.at(-1)?.getDay()).toBe(0);
    expect(days[0] && toDateValue(days[0])).toBe("2026-04-27");
  });

  it("creates the twelve-year block containing the focused year", () => {
    expect(getYearBlock(2026)).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021,
      2022, 2023, 2024, 2025, 2026, 2027,
    ]);
  });

  it("moves according to the active calendar mode", () => {
    const date = new Date(2026, 4, 15);

    expect(toDateValue(shiftCalendarView(date, "days", 1))).toBe("2026-06-15");
    expect(toDateValue(shiftCalendarView(date, "months", -1))).toBe("2025-05-15");
    expect(shiftCalendarView(date, "years", 1).getFullYear()).toBe(2038);
  });
});
