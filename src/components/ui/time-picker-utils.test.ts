import { describe, expect, it } from "vitest";
import {
  formatTimeValue,
  isTimeWithinRange,
  parseTimeValue,
  resolvePeriodForRange,
  toTimeValue,
} from "./time-picker-utils";

describe("time picker values", () => {
  it("converts 24-hour values to 12-hour parts and back", () => {
    expect(parseTimeValue("00:08")).toEqual({
      hour: 12,
      minute: 8,
      period: "AM",
    });
    expect(parseTimeValue("17:14")).toEqual({
      hour: 5,
      minute: 14,
      period: "PM",
    });
    expect(toTimeValue({ hour: 12, minute: 0, period: "PM" })).toBe("12:00");
    expect(toTimeValue({ hour: 3, minute: 12, period: "AM" })).toBe("03:12");
  });

  it("formats the displayed time in Spanish", () => {
    expect(formatTimeValue("09:05")).toBe("9:05 a. m.");
    expect(formatTimeValue("15:12")).toBe("3:12 p. m.");
  });

  it("validates inclusive and exclusive ranges", () => {
    expect(isTimeWithinRange("09:00", "08:00", "18:00")).toBe(true);
    expect(isTimeWithinRange("18:00", "08:00", "18:00", true)).toBe(false);
    expect(isTimeWithinRange("07:59", "08:00", "18:00")).toBe(false);
  });

  it("selects PM when the chosen hour is only available after noon", () => {
    expect(
      resolvePeriodForRange(
        { hour: 1, minute: 8, period: "AM" },
        "08:00",
        "18:00",
        true
      )
    ).toBe("PM");
    expect(
      resolvePeriodForRange(
        { hour: 5, minute: 14, period: "AM" },
        "08:00",
        "18:00",
        true
      )
    ).toBe("PM");
  });
});
