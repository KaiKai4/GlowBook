import { describe, expect, it } from "vitest";
import { buildAppointmentsHref } from "./calendar-url";

describe("buildAppointmentsHref", () => {
  it("serializes date and view into the appointments route", () => {
    expect(buildAppointmentsHref({ date: "2026-06-06", view: "semanal" })).toBe(
      "/appointments?date=2026-06-06&view=semanal"
    );
  });

  it("keeps worker view as normal URL state", () => {
    expect(buildAppointmentsHref({ date: "2026-06-07", view: "trabajador" })).toBe(
      "/appointments?date=2026-06-07&view=trabajador"
    );
  });
});
