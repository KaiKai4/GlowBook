import { describe, expect, it } from "vitest";
import { assertTransition, shouldBlockCalendar } from "./lifecycle";

describe("appointment lifecycle", () => {
  it("allows only valid status transitions", () => {
    expect(() => assertTransition("scheduled", "confirmed")).not.toThrow();
    expect(() => assertTransition("confirmed", "completed")).not.toThrow();
    expect(() => assertTransition("completed", "cancelled")).toThrow();
    expect(() => assertTransition("cancelled", "confirmed")).toThrow();
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
