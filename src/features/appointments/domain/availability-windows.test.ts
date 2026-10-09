import { describe, expect, it } from "vitest";
import { evaluateTimeRange } from "./availability";
import type { BusinessHour, SalonConfig, WorkSchedule } from "./types";

// Lunes 2026-05-25. America/Panama es UTC-5: 10:00 locales = 15:00Z.
const salonConfig: SalonConfig = {
  timezone: "America/Panama",
  allow_off_hours_bookings: false,
  min_booking_notice_minutes: 0,
  min_appointment_duration_minutes: 30,
};

const openAllMonday: BusinessHour[] = [
  { day_of_week: 0, is_open: true, open_time: "08:00", close_time: "20:00" },
];

function shift(day_of_week: number, start_time: string, end_time: string): WorkSchedule {
  return { day_of_week, is_active: true, start_time, end_time };
}

function codesFor(startUtc: string, endUtc: string, workSchedules: WorkSchedule[]): string[] {
  return evaluateTimeRange({
    start: new Date(startUtc),
    end: new Date(endUtc),
    salonConfig,
    businessHours: openAllMonday,
    workSchedules,
    occupiedSlots: [],
    enforceMinDuration: false,
  }).map((violation) => violation.code);
}

describe("disponibilidad: fusión de turnos del profesional", () => {
  it("une turnos solapados y permite una reserva que cruza su unión", () => {
    // Turnos 10:00-12:00 y 11:00-14:00 se funden en 10:00-14:00.
    // Reserva 12:00-13:30: ningún turno por separado la contiene.
    const codes = codesFor("2026-05-25T17:00:00.000Z", "2026-05-25T18:30:00.000Z", [
      shift(0, "10:00", "12:00"),
      shift(0, "11:00", "14:00"),
    ]);

    expect(codes).not.toContain("employee_outside_hours");
  });

  it("conserva el final más tardío cuando un turno interno termina antes", () => {
    // Turnos 10:00-14:00 y 11:00-12:00: la unión sigue terminando a las 14:00.
    const codes = codesFor("2026-05-25T18:00:00.000Z", "2026-05-25T18:30:00.000Z", [
      shift(0, "10:00", "14:00"),
      shift(0, "11:00", "12:00"),
    ]);

    expect(codes).not.toContain("employee_outside_hours");
  });

  it("mantiene turnos separados cuando no se solapan y bloquea el hueco entre ellos", () => {
    const schedules = [shift(0, "10:00", "11:00"), shift(0, "13:00", "14:00")];

    // 13:00-13:30 cae dentro del segundo turno.
    expect(codesFor("2026-05-25T18:00:00.000Z", "2026-05-25T18:30:00.000Z", schedules)).not.toContain(
      "employee_outside_hours"
    );
    // 11:30-12:00 queda en el hueco entre turnos.
    expect(codesFor("2026-05-25T16:30:00.000Z", "2026-05-25T17:00:00.000Z", schedules)).toContain(
      "employee_outside_hours"
    );
  });

  it("marca día libre cuando el profesional no tiene turno ese día", () => {
    expect(codesFor("2026-05-25T15:00:00.000Z", "2026-05-25T15:30:00.000Z", [shift(1, "10:00", "16:00")])).toContain(
      "employee_day_off"
    );
  });

  it("ignora los turnos inactivos al calcular la disponibilidad", () => {
    const inactive: WorkSchedule = { day_of_week: 0, is_active: false, start_time: "10:00", end_time: "16:00" };

    expect(codesFor("2026-05-25T15:00:00.000Z", "2026-05-25T15:30:00.000Z", [inactive])).toContain(
      "employee_day_off"
    );
  });
});
