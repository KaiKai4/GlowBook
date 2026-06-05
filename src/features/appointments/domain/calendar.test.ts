import { describe, expect, it } from "vitest";
import { countActiveCalendarAppointments } from "./calendar";
import type { AppointmentStatus } from "./lifecycle";

function appointment(status: AppointmentStatus, start_time = "2030-01-07T14:00:00.000Z") {
  return { status, start_time };
}

describe("calendar domain", () => {
  it("counts only scheduled and confirmed appointments as active", () => {
    const count = countActiveCalendarAppointments(
      [
        appointment("scheduled"),
        appointment("confirmed"),
        appointment("completed"),
        appointment("cancelled"),
        appointment("no_show"),
      ],
      "diaria",
      [],
      "UTC"
    );

    expect(count).toBe(2);
  });

  it("counts weekly active appointments only inside visible week dates", () => {
    const count = countActiveCalendarAppointments(
      [
        appointment("scheduled", "2030-01-07T14:00:00.000Z"),
        appointment("confirmed", "2030-01-08T14:00:00.000Z"),
        appointment("scheduled", "2030-01-12T14:00:00.000Z"),
      ],
      "semanal",
      ["2030-01-07", "2030-01-08"],
      "UTC"
    );

    expect(count).toBe(2);
  });
});
