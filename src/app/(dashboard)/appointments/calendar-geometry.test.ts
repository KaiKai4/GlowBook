import { describe, expect, it } from "vitest";
import { buildCalendarAppointment, SALON_TZ, TEST_DATE } from "@/test/ui-appointments-fixtures";
import {
  assignColumns,
  computeRange,
  getLocalDate,
  hourLabel,
  todayISO,
} from "./calendar-geometry";

function at(hhmm: string): string {
  return `${TEST_DATE}T${hhmm}:00-05:00`;
}

describe("hourLabel", () => {
  it("convierte medianoche y mediodia al formato de 12 horas", () => {
    expect(hourLabel(0)).toEqual({ num: 12, period: "am" });
    expect(hourLabel(12)).toEqual({ num: 12, period: "pm" });
  });

  it("separa am y pm en horas de la mañana y la tarde", () => {
    expect(hourLabel(8)).toEqual({ num: 8, period: "am" });
    expect(hourLabel(13)).toEqual({ num: 1, period: "pm" });
    expect(hourLabel(23)).toEqual({ num: 11, period: "pm" });
  });

  it("normaliza horas fuera de 0-23", () => {
    expect(hourLabel(24)).toEqual({ num: 12, period: "am" });
    expect(hourLabel(-1)).toEqual({ num: 11, period: "pm" });
  });
});

describe("computeRange", () => {
  it("usa el horario del salón cuando no hay citas", () => {
    expect(computeRange([], SALON_TZ, 8, 21)).toEqual({ calStart: 8, calEnd: 21 });
  });

  it("ensancha la grilla hacia atras y hacia adelante para citas fuera de horario", () => {
    const appts = [
      buildCalendarAppointment({ start_time: at("06:30"), end_time: at("07:00") }),
      buildCalendarAppointment({ id: "late", start_time: at("21:00"), end_time: at("22:15") }),
    ];
    expect(computeRange(appts, SALON_TZ, 8, 21)).toEqual({ calStart: 6, calEnd: 23 });
  });

  it("redondea hacia arriba cuando la cita termina a mitad de hora", () => {
    const appts = [buildCalendarAppointment({ start_time: at("10:00"), end_time: at("11:20") })];
    expect(computeRange(appts, SALON_TZ, 8, 11)).toEqual({ calStart: 8, calEnd: 12 });
  });

  it("asume una hora cuando la cita no tiene fin", () => {
    const appts = [buildCalendarAppointment({ start_time: at("20:30"), end_time: null })];
    expect(computeRange(appts, SALON_TZ, 8, 21)).toEqual({ calStart: 8, calEnd: 21 });
    const late = [buildCalendarAppointment({ start_time: at("21:30"), end_time: null })];
    expect(computeRange(late, SALON_TZ, 8, 21)).toEqual({ calStart: 8, calEnd: 22 });
  });

  it("ignora citas sin hora de inicio", () => {
    const appts = [buildCalendarAppointment({ start_time: null, end_time: null })];
    expect(computeRange(appts, SALON_TZ, 8, 21)).toEqual({ calStart: 8, calEnd: 21 });
  });

  it("garantiza al menos una hora visible y no supera el día completo", () => {
    expect(computeRange([], SALON_TZ, 10, 10)).toEqual({ calStart: 10, calEnd: 11 });
    const appts = [buildCalendarAppointment({ start_time: at("23:30"), end_time: null })];
    expect(computeRange(appts, SALON_TZ, 8, 21)).toEqual({ calStart: 8, calEnd: 24 });
  });
});

describe("assignColumns", () => {
  it("coloca citas solapadas en columnas distintas", () => {
    const appts = [
      buildCalendarAppointment({ id: "a", start_time: at("09:00"), end_time: at("10:00") }),
      buildCalendarAppointment({ id: "b", start_time: at("09:30"), end_time: at("10:30") }),
    ];
    const { items, totalCols } = assignColumns(appts, SALON_TZ, 8);
    expect(totalCols).toBe(2);
    expect(items.map((i) => [i.appt.id, i.col])).toEqual([["a", 0], ["b", 1]]);
  });

  it("reutiliza la columna cuando la cita anterior ya terminó", () => {
    const appts = [
      buildCalendarAppointment({ id: "a", start_time: at("09:00"), end_time: at("10:00") }),
      buildCalendarAppointment({ id: "b", start_time: at("10:00"), end_time: at("11:00") }),
    ];
    const { items, totalCols } = assignColumns(appts, SALON_TZ, 8);
    expect(totalCols).toBe(1);
    expect(items.map((i) => i.col)).toEqual([0, 0]);
  });

  it("calcula minutos desde el inicio de la grilla y asume 30 minutos sin fin", () => {
    const appts = [buildCalendarAppointment({ start_time: at("09:15"), end_time: null })];
    const { items } = assignColumns(appts, SALON_TZ, 8);
    expect(items[0]).toMatchObject({ startMin: 75, endMin: 105 });
  });

  it("omite citas sin inicio y devuelve al menos una columna", () => {
    const { items, totalCols } = assignColumns(
      [buildCalendarAppointment({ start_time: null })],
      SALON_TZ,
      8
    );
    expect(items).toEqual([]);
    expect(totalCols).toBe(1);
  });
});

describe("getLocalDate", () => {
  it("devuelve la fecha local del salón en formato ISO", () => {
    expect(getLocalDate(`${TEST_DATE}T23:30:00-05:00`, SALON_TZ)).toBe(TEST_DATE);
    expect(getLocalDate(`${TEST_DATE}T23:30:00-05:00`, "UTC")).toBe("2026-10-13");
  });
});

describe("todayISO", () => {
  it("devuelve una fecha con formato AAAA-MM-DD", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
