import { describe, expect, it } from "vitest";
import { evaluateTimeRange, getEffectiveWindows } from "./availability";
import type { BusinessHour, SalonConfig, WorkSchedule } from "./types";

const salonConfig: SalonConfig = {
  timezone: "America/Panama",
  allow_off_hours_bookings: false,
  min_booking_notice_minutes: 60,
  min_appointment_duration_minutes: 30,
};

const mondayBusinessHours: BusinessHour[] = [
  { day_of_week: 0, is_open: true, open_time: "09:00", close_time: "17:00" },
];

const mondayWorkSchedule: WorkSchedule[] = [
  { day_of_week: 0, is_active: true, start_time: "10:00", end_time: "16:00" },
];

describe("appointment availability", () => {
  it("intersects salon and collaborator windows by default", () => {
    const windows = getEffectiveWindows(
      new Date("2026-05-25T15:00:00.000Z"),
      "America/Panama",
      mondayBusinessHours,
      mondayWorkSchedule,
      false
    );

    expect(windows).toEqual([{ start: "10:00", end: "16:00" }]);
  });

  it("uses collaborator windows when off-hours bookings are allowed", () => {
    const windows = getEffectiveWindows(
      new Date("2026-05-25T15:00:00.000Z"),
      "America/Panama",
      mondayBusinessHours,
      [{ day_of_week: 0, is_active: true, start_time: "07:00", end_time: "19:00" }],
      true
    );

    expect(windows).toEqual([{ start: "07:00", end: "19:00" }]);
  });

  it("reports salon, collaborator and occupied-slot violations together", () => {
    const start = new Date("2026-05-25T22:30:00.000Z"); // 17:30 Panama, after salon close.
    const end = new Date("2026-05-25T23:00:00.000Z");
    const violations = evaluateTimeRange({
      start,
      end,
      salonConfig,
      businessHours: mondayBusinessHours,
      workSchedules: mondayWorkSchedule,
      occupiedSlots: [{ start_time: start.toISOString(), end_time: end.toISOString() }],
    });

    expect(violations.map((violation) => violation.code)).toEqual([
      "salon_off_hours",
      "employee_outside_hours",
      "occupied",
    ]);
  });

  it("enforces minimum duration without requiring booking notice", () => {
    const violations = evaluateTimeRange({
      start: new Date("2026-05-25T14:30:00.000Z"),
      end: new Date("2026-05-25T14:45:00.000Z"),
      salonConfig,
      businessHours: mondayBusinessHours,
      workSchedules: [],
      occupiedSlots: [],
    });

    expect(violations.map((violation) => violation.code)).toEqual(["min_duration"]);
  });
});
