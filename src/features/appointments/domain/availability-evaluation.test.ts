import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluateTimeRange } from "./availability";
import type { BusinessHour, OccupiedSlot, RangeEvaluationInput, SalonConfig, WorkSchedule } from "./types";

// 2026-05-25 es lunes (day_of_week 0). Panamá es UTC-5 sin horario de verano.
const salonConfig: SalonConfig = {
  timezone: "America/Panama",
  allow_off_hours_bookings: false,
  min_booking_notice_minutes: 0,
  min_appointment_duration_minutes: 30,
};

/** Convierte una hora de pared de Panamá (YYYY-MM-DDTHH:mm) a instante UTC. */
function panama(wallClock: string): Date {
  return new Date(`${wallClock}:00-05:00`);
}

function evaluate(overrides: Partial<RangeEvaluationInput> & Pick<RangeEvaluationInput, "start" | "end">) {
  return evaluateTimeRange({
    salonConfig,
    businessHours: [{ day_of_week: 0, is_open: true, open_time: "08:00", close_time: "18:00" }],
    ...overrides,
  });
}

function codes(violations: ReturnType<typeof evaluateTimeRange>): string[] {
  return violations.map((violation) => violation.code);
}

const mondayAllDay: WorkSchedule[] = [
  { day_of_week: 0, is_active: true, start_time: "08:00", end_time: "18:00" },
];

describe("evaluateTimeRange: duración mínima y horario del salón", () => {
  it("rechaza una reserva más corta que la duración mínima del salón", () => {
    const violations = evaluate({ start: panama("2026-05-25T10:00"), end: panama("2026-05-25T10:20") });

    expect(violations).toEqual([
      { code: "min_duration", message: "La duración mínima es 30 minutos." },
    ]);
  });

  it("omite la validación de duración cuando se desactiva", () => {
    const violations = evaluate({
      start: panama("2026-05-25T10:00"),
      end: panama("2026-05-25T10:20"),
      enforceMinDuration: false,
    });

    expect(violations).toEqual([]);
  });

  it("usa el horario por defecto del salón (lunes a sábado 08-18) cuando no hay fila para el día", () => {
    const violations = evaluate({
      start: panama("2026-05-25T10:00"),
      end: panama("2026-05-25T11:00"),
      businessHours: [],
    });

    expect(violations).toEqual([]);
  });

  it("marca el domingo como día cerrado cuando no hay fila de horario", () => {
    const violations = evaluate({
      start: panama("2026-05-31T10:00"),
      end: panama("2026-05-31T11:00"),
      businessHours: [],
    });

    expect(codes(violations)).toEqual(["salon_closed_day"]);
  });

  it("marca día cerrado cuando el horario configurado indica is_open false o sin horas", () => {
    const closedFlag: BusinessHour[] = [
      { day_of_week: 0, is_open: false, open_time: "08:00", close_time: "18:00" },
    ];
    const missingHours: BusinessHour[] = [
      { day_of_week: 0, is_open: true, open_time: null, close_time: "18:00" },
    ];

    const start = panama("2026-05-25T10:00");
    const end = panama("2026-05-25T11:00");

    expect(codes(evaluate({ start, end, businessHours: closedFlag }))).toEqual(["salon_closed_day"]);
    expect(codes(evaluate({ start, end, businessHours: missingHours }))).toEqual(["salon_closed_day"]);
  });

  it("rechaza una reserva que empieza antes de la apertura", () => {
    const violations = evaluate({ start: panama("2026-05-25T07:30"), end: panama("2026-05-25T08:30") });

    expect(codes(violations)).toEqual(["salon_off_hours"]);
  });

  it("rechaza una reserva que termina después del cierre", () => {
    const violations = evaluate({ start: panama("2026-05-25T17:30"), end: panama("2026-05-25T18:30") });

    expect(codes(violations)).toEqual(["salon_off_hours"]);
  });

  it("acepta una reserva que termina exactamente a la hora de cierre", () => {
    const violations = evaluate({ start: panama("2026-05-25T17:00"), end: panama("2026-05-25T18:00") });

    expect(violations).toEqual([]);
  });

  it("no aplica el horario del salón cuando enforceSalonSchedule es false", () => {
    const violations = evaluate({
      start: panama("2026-05-31T10:00"),
      end: panama("2026-05-31T11:00"),
      businessHours: [],
      enforceSalonSchedule: false,
    });

    expect(violations).toEqual([]);
  });

  it("propiedad: una reserva dentro del horario del salón y de la duración mínima no tiene violaciones", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 480, max: 1080 - 30 }),
        fc.integer({ min: 30, max: 120 }),
        (startMinutes, duration) => {
          fc.pre(startMinutes + duration <= 1080);
          const dayStartUtc = Date.UTC(2026, 4, 25, 5, 0, 0);
          const start = new Date(dayStartUtc + startMinutes * 60_000);
          const end = new Date(start.getTime() + duration * 60_000);

          expect(evaluate({ start, end })).toEqual([]);
        }
      )
    );
  });

  it("propiedad: una reserva que termina después de las 18:00 siempre reporta horario fuera de atención", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1020, max: 1079 }),
        fc.integer({ min: 30, max: 120 }),
        (startMinutes, duration) => {
          fc.pre(startMinutes + duration > 1080);
          const dayStartUtc = Date.UTC(2026, 4, 25, 5, 0, 0);
          const start = new Date(dayStartUtc + startMinutes * 60_000);
          const end = new Date(start.getTime() + duration * 60_000);

          expect(codes(evaluate({ start, end }))).toContain("salon_off_hours");
        }
      )
    );
  });
});

describe("evaluateTimeRange: excepciones y turnos del profesional", () => {
  it("bloquea el día libre puntual usando la fecha local del salón, no la UTC", () => {
    const start = panama("2026-05-25T20:00"); // 2026-05-26 en UTC
    const end = panama("2026-05-25T21:00");
    const hours: BusinessHour[] = [
      { day_of_week: 0, is_open: true, open_time: "08:00", close_time: "22:00" },
    ];

    expect(codes(evaluate({ start, end, businessHours: hours, employeeExceptionDates: ["2026-05-25"] }))).toEqual([
      "employee_exception",
    ]);
    expect(evaluate({ start, end, businessHours: hours, employeeExceptionDates: ["2026-05-26"] })).toEqual([]);
  });

  it("no consulta días libres cuando la lista está vacía", () => {
    const violations = evaluate({
      start: panama("2026-05-25T10:00"),
      end: panama("2026-05-25T11:00"),
      employeeExceptionDates: [],
    });

    expect(violations).toEqual([]);
  });

  it("marca día libre del profesional cuando no tiene turno activo ese día", () => {
    const tuesdayOnly: WorkSchedule[] = [
      { day_of_week: 1, is_active: true, start_time: "08:00", end_time: "18:00" },
    ];

    expect(
      codes(
        evaluate({
          start: panama("2026-05-25T10:00"),
          end: panama("2026-05-25T11:00"),
          workSchedules: tuesdayOnly,
        })
      )
    ).toEqual(["employee_day_off"]);
  });

  it("trata un turno inactivo como día libre", () => {
    const inactive: WorkSchedule[] = [
      { day_of_week: 0, is_active: false, start_time: "08:00", end_time: "18:00" },
    ];

    expect(
      codes(
        evaluate({
          start: panama("2026-05-25T10:00"),
          end: panama("2026-05-25T11:00"),
          workSchedules: inactive,
        })
      )
    ).toEqual(["employee_day_off"]);
  });

  it("no aplica turnos del profesional cuando no tiene horario registrado", () => {
    const violations = evaluate({
      start: panama("2026-05-25T17:00"),
      end: panama("2026-05-25T17:30"),
      workSchedules: [],
      enforceMinDuration: false,
    });

    expect(violations).toEqual([]);
  });

  it("une turnos que se tocan y permite una reserva que cruza el punto de unión", () => {
    const touching: WorkSchedule[] = [
      { day_of_week: 0, is_active: true, start_time: "10:00", end_time: "12:00" },
      { day_of_week: 0, is_active: true, start_time: "12:00", end_time: "14:00" },
    ];

    expect(
      evaluate({
        start: panama("2026-05-25T11:30"),
        end: panama("2026-05-25T12:30"),
        workSchedules: touching,
      })
    ).toEqual([]);
  });

  it("rechaza una reserva que cruza un hueco entre dos turnos separados", () => {
    const withGap: WorkSchedule[] = [
      { day_of_week: 0, is_active: true, start_time: "10:00", end_time: "12:00" },
      { day_of_week: 0, is_active: true, start_time: "13:00", end_time: "14:00" },
    ];

    expect(
      codes(
        evaluate({
          start: panama("2026-05-25T11:30"),
          end: panama("2026-05-25T13:30"),
          workSchedules: withGap,
        })
      )
    ).toEqual(["employee_outside_hours"]);
  });

  it("conserva el final más tardío cuando un turno interno termina antes", () => {
    const nested: WorkSchedule[] = [
      { day_of_week: 0, is_active: true, start_time: "15:00", end_time: "16:00" },
      { day_of_week: 0, is_active: true, start_time: "09:00", end_time: "17:00" },
      { day_of_week: 0, is_active: true, start_time: "10:00", end_time: "11:00" },
    ];

    expect(
      evaluate({
        start: panama("2026-05-25T15:30"),
        end: panama("2026-05-25T16:30"),
        workSchedules: nested,
      })
    ).toEqual([]);
  });

  it("reporta fuera de turno cuando la reserva sobrepasa el turno del profesional", () => {
    const shift: WorkSchedule[] = [
      { day_of_week: 0, is_active: true, start_time: "10:00", end_time: "12:00" },
    ];

    expect(
      codes(
        evaluate({
          start: panama("2026-05-25T11:30"),
          end: panama("2026-05-25T12:30"),
          workSchedules: shift,
        })
      )
    ).toEqual(["employee_outside_hours"]);
  });
});

describe("evaluateTimeRange: ocupación", () => {
  const occupied = (startIso: string, endIso: string): OccupiedSlot => ({
    start_time: startIso,
    end_time: endIso,
  });

  it("detecta solapamiento real con una cita existente", () => {
    const violations = evaluate({
      start: panama("2026-05-25T10:30"),
      end: panama("2026-05-25T11:30"),
      occupiedSlots: [occupied("2026-05-25T18:00:00.000Z", "2026-05-25T19:00:00.000Z")],
    });

    expect(violations).toEqual([]);

    const overlapping = evaluate({
      start: panama("2026-05-25T10:30"),
      end: panama("2026-05-25T11:30"),
      occupiedSlots: [occupied(panama("2026-05-25T10:00").toISOString(), panama("2026-05-25T11:00").toISOString())],
    });

    expect(codes(overlapping)).toEqual(["occupied"]);
  });

  it("una cita que empieza justo cuando termina otra no es solapamiento", () => {
    const violations = evaluate({
      start: panama("2026-05-25T11:00"),
      end: panama("2026-05-25T12:00"),
      occupiedSlots: [occupied(panama("2026-05-25T10:00").toISOString(), panama("2026-05-25T11:00").toISOString())],
    });

    expect(violations).toEqual([]);
  });

  it("reporta una sola violación de ocupación aunque choque con varias citas", () => {
    const violations = evaluate({
      start: panama("2026-05-25T10:00"),
      end: panama("2026-05-25T12:00"),
      occupiedSlots: [
        occupied(panama("2026-05-25T10:00").toISOString(), panama("2026-05-25T10:30").toISOString()),
        occupied(panama("2026-05-25T11:00").toISOString(), panama("2026-05-25T11:30").toISOString()),
      ],
    });

    expect(codes(violations)).toEqual(["occupied"]);
  });

  it("acumula violaciones de salón, profesional y ocupación en el orden definido", () => {
    const violations = evaluate({
      start: panama("2026-05-25T17:30"),
      end: panama("2026-05-25T18:30"),
      workSchedules: [{ day_of_week: 0, is_active: true, start_time: "08:00", end_time: "17:00" }],
      occupiedSlots: [occupied(panama("2026-05-25T17:45").toISOString(), panama("2026-05-25T18:15").toISOString())],
    });

    expect(codes(violations)).toEqual(["salon_off_hours", "employee_outside_hours", "occupied"]);
  });

  it("acepta una reserva completamente dentro del turno del profesional", () => {
    expect(
      evaluate({
        start: panama("2026-05-25T09:00"),
        end: panama("2026-05-25T10:00"),
        workSchedules: mondayAllDay,
      })
    ).toEqual([]);
  });
});
