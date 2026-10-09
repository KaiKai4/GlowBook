import { describe, expect, it } from "vitest";
import {
  formatCalendarDateLabel,
  getBusinessHourRange,
  getVisibleWeekDates,
  getWeekDates,
  type BusinessDayConfig,
} from "./calendar";

const MONDAY = "2026-05-25";

function openDay(day_of_week: number, open_time: string, close_time: string): BusinessDayConfig {
  return { day_of_week, is_open: true, open_time, close_time };
}

describe("calendario: semana y días visibles", () => {
  it("calcula la semana de lunes a domingo aunque la fecha sea domingo", () => {
    expect(getWeekDates("2026-05-31")).toEqual([
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
      "2026-05-31",
    ]);
  });

  it("sin horario configurado muestra de lunes a sábado por defecto", () => {
    const visible = getVisibleWeekDates(MONDAY, []);

    expect(visible).toHaveLength(6);
    expect(visible).not.toContain("2026-05-31");
  });

  it("oculta los días cerrados según el horario del salón", () => {
    const hours: BusinessDayConfig[] = [
      openDay(0, "09:00", "18:00"),
      { day_of_week: 1, is_open: false, open_time: null, close_time: null },
      openDay(2, "09:00", "18:00"),
      { day_of_week: 3, is_open: true, open_time: "09:00", close_time: null },
    ];

    expect(getVisibleWeekDates(MONDAY, hours)).toEqual(["2026-05-25", "2026-05-27"]);
  });
});

describe("calendario: rango horario del salón", () => {
  it("usa 08:00 a 21:00 cuando no hay ningún día abierto", () => {
    expect(getBusinessHourRange([])).toEqual({ businessStart: 8, businessEnd: 21 });
    expect(
      getBusinessHourRange([{ day_of_week: 0, is_open: false, open_time: null, close_time: null }])
    ).toEqual({ businessStart: 8, businessEnd: 21 });
  });

  it("toma la apertura más temprana y el cierre más tardío entre días abiertos", () => {
    const hours = [
      openDay(0, "09:30", "18:00"),
      openDay(1, "07:00", "20:30"),
      { day_of_week: 2, is_open: false, open_time: "05:00", close_time: "23:00" },
    ];

    // El miércoles está cerrado y no debe ampliar el rango.
    expect(getBusinessHourRange(hours)).toEqual({ businessStart: 7, businessEnd: 21 });
  });

  it("redondea hacia arriba el cierre cuando tiene minutos", () => {
    expect(getBusinessHourRange([openDay(0, "08:00", "18:15")])).toEqual({
      businessStart: 8,
      businessEnd: 19,
    });
    expect(getBusinessHourRange([openDay(0, "08:00", "18:00")])).toEqual({
      businessStart: 8,
      businessEnd: 18,
    });
  });
});

describe("calendario: etiqueta de fecha", () => {
  it("formatea el rango de la semana visible en vista semanal", () => {
    const week = getWeekDates(MONDAY);
    const label = formatCalendarDateLabel(MONDAY, "semanal", week.slice(0, 6), week);

    expect(label).toMatch(/^25 - 30 de mayo$/);
  });

  it("usa la semana completa cuando no hay días visibles", () => {
    const week = getWeekDates(MONDAY);

    expect(formatCalendarDateLabel(MONDAY, "semanal", [], week)).toMatch(/^25 - 31 de mayo$/);
  });

  it("falla explícitamente en vista semanal si no hay ninguna fecha que mostrar", () => {
    expect(() => formatCalendarDateLabel(MONDAY, "semanal", [], [])).toThrow(
      "Invariante de calendario: sin fechas visibles."
    );
  });
});
