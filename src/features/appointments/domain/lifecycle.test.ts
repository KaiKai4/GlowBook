import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, shouldBlockCalendar } from "./lifecycle";

describe("appointment lifecycle", () => {
  it("allows only valid status transitions", () => {
    expect(canTransition("scheduled", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "completed")).toBe(true);
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  it("throws when an invalid transition is requested", () => {
    expect(() => assertTransition("completed", "confirmed")).toThrow(
      'No se puede cambiar el estado de "completed" a "confirmed".'
    );
  });

  it("only scheduled and confirmed appointments block the calendar", () => {
    expect(shouldBlockCalendar("scheduled")).toBe(true);
    expect(shouldBlockCalendar("confirmed")).toBe(true);
    expect(shouldBlockCalendar("completed")).toBe(false);
    expect(shouldBlockCalendar("cancelled")).toBe(false);
    expect(shouldBlockCalendar("no_show")).toBe(false);
  });
});
