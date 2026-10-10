import { describe, expect, it } from "vitest";
import {
  formatClockTime,
  formatDayMonth,
  formatEsDate,
  formatHour12,
  formatLongDateTime,
  formatMonthShort,
  formatNumericDate,
  formatNumericDateTime,
  formatWeekdayDateTime,
  formatWeekdayDayMonth,
  formatWeekdayShort,
} from "./es-formats";

// 12 oct 2026, 14:30 UTC. En America/Panama (UTC-5) son las 09:30.
const INSTANT = new Date(Date.UTC(2026, 9, 12, 14, 30));
const PANAMA = "America/Panama";

describe("formatos es-PA", () => {
  it("formatEsDate aplica las opciones dadas en español", () => {
    expect(formatEsDate(INSTANT, { month: "long", timeZone: "UTC" })).toBe("octubre");
  });

  it("formatWeekdayDayMonth respeta la zona, el estilo de mes y el año opcional", () => {
    expect(formatWeekdayDayMonth(INSTANT, { weekday: "long", month: "short", timeZone: PANAMA })).toBe("lunes, 12 oct");
    expect(formatWeekdayDayMonth(INSTANT, { weekday: "long", month: "long", year: true, timeZone: "UTC" })).toBe(
      "lunes, 12 de octubre de 2026"
    );
  });

  it("formatDayMonth por defecto usa mes abreviado", () => {
    expect(formatDayMonth(INSTANT, { month: "short", timeZone: "UTC" })).toBe("12 oct");
    expect(formatDayMonth(INSTANT, { month: "long", timeZone: "UTC" })).toBe("12 de octubre");
  });

  it("formatWeekdayShort devuelve el día abreviado", () => {
    expect(formatWeekdayShort(INSTANT, "UTC")).toBe("lun");
  });

  it("formatMonthShort quita el punto final", () => {
    expect(formatMonthShort(INSTANT, "UTC")).toBe("oct");
  });

  it("formatHour12 devuelve la hora de 12 horas", () => {
    expect(formatHour12(new Date(Date.UTC(2026, 0, 1, 15)), "UTC")).toBe("3 p. m.");
  });

  it("formatClockTime devuelve hora y minutos en la zona indicada", () => {
    expect(formatClockTime(INSTANT, PANAMA)).toBe("09:30 a. m.");
  });

  it("formatWeekdayDateTime combina día, mes y hora", () => {
    expect(formatWeekdayDateTime(INSTANT, PANAMA)).toBe("lun, 12 oct, 09:30 a. m.");
  });

  it("formatos numéricos y de fecha larga", () => {
    expect(formatNumericDate(INSTANT)).toBe(INSTANT.toLocaleDateString("es-PA"));
    expect(formatNumericDateTime(INSTANT)).toBe(INSTANT.toLocaleString("es-PA"));
    expect(formatLongDateTime(INSTANT, PANAMA)).toBe("12 de octubre de 2026 a las 9:30 a. m.");
  });
});
