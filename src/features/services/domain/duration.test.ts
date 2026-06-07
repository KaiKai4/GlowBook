import { describe, expect, it } from "vitest";
import {
  combineServiceDuration,
  isValidServiceDurationParts,
  splitServiceDuration,
} from "./duration";

describe("service duration", () => {
  it("splits stored minutes into hours and remaining minutes", () => {
    expect(splitServiceDuration(50)).toEqual({ hours: 0, minutes: 50 });
    expect(splitServiceDuration(150)).toEqual({ hours: 2, minutes: 30 });
  });

  it("combines hours and minutes into the stored minute value", () => {
    expect(combineServiceDuration({ hours: 0, minutes: 40 })).toBe(40);
    expect(combineServiceDuration({ hours: 1, minutes: 50 })).toBe(110);
  });

  it("accepts any real service duration while keeping minute parts readable", () => {
    expect(isValidServiceDurationParts({ hours: 0, minutes: 1 })).toBe(true);
    expect(isValidServiceDurationParts({ hours: 0, minutes: 50 })).toBe(true);
    expect(isValidServiceDurationParts({ hours: 2, minutes: 0 })).toBe(true);
    expect(isValidServiceDurationParts({ hours: 0, minutes: 0 })).toBe(false);
    expect(isValidServiceDurationParts({ hours: 1, minutes: 60 })).toBe(false);
  });
});
