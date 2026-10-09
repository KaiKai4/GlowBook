import fc from "fast-check";
import { addDays, getDay, isSameMonth } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  getCalendarDays,
  getYearBlock,
  parseDateValue,
  shiftCalendarView,
  toDateValue,
} from "./date-picker-utils";

// Fechas entre 1900 y 2099 para cubrir años bisiestos y cambios de mes.
const monthDate = fc
  .record({
    year: fc.integer({ min: 1900, max: 2099 }),
    month: fc.integer({ min: 0, max: 11 }),
  })
  .map(({ year, month }) => new Date(year, month, 15));

describe("date picker utils (propiedades)", () => {
  it("la cuadrícula es siempre de semanas completas, empieza en lunes y tiene al menos 42 días", () => {
    fc.assert(
      fc.property(monthDate, (month) => {
        const days = getCalendarDays(month);

        expect(days.length % 7).toBe(0);
        expect(days.length).toBeGreaterThanOrEqual(42);
        expect(getDay(days[0] as Date)).toBe(1);
        expect(getDay(days.at(-1) as Date)).toBe(0);
      })
    );
  });

  it("la cuadrícula contiene todos los días del mes, consecutivos y sin repetir", () => {
    fc.assert(
      fc.property(monthDate, (month) => {
        const days = getCalendarDays(month);
        const values = days.map(toDateValue);

        expect(new Set(values).size).toBe(values.length);
        for (let index = 1; index < days.length; index += 1) {
          expect(toDateValue(days[index] as Date)).toBe(toDateValue(addDays(days[index - 1] as Date, 1)));
        }
        const monthDays = days.filter((day) => isSameMonth(day, month));
        expect(monthDays.length).toBe(new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
      })
    );
  });

  it("el bloque de años tiene doce años consecutivos, empieza en múltiplo de 12 y contiene el año pedido", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1900, max: 2099 }), (year) => {
        const block = getYearBlock(year);

        expect(block).toHaveLength(12);
        expect(block[0] as number).toBe(Math.floor(year / 12) * 12);
        expect(block).toContain(year);
        for (let index = 1; index < block.length; index += 1) {
          expect((block[index] as number) - (block[index - 1] as number)).toBe(1);
        }
      })
    );
  });

  it("toDateValue y parseDateValue son inversos para cualquier fecha", () => {
    fc.assert(
      fc.property(monthDate, (date) => {
        const value = toDateValue(date);
        expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(toDateValue(parseDateValue(value) as Date)).toBe(value);
      })
    );
  });

  it("avanzar y retroceder en vista de días se cancela siempre", () => {
    fc.assert(
      fc.property(monthDate, (date) => {
        const forward = shiftCalendarView(date, "days", 1);
        const back = shiftCalendarView(forward, "days", -1);
        expect(toDateValue(back)).toBe(toDateValue(date));
      })
    );
  });

  it("en vista de años cada desplazamiento avanza o retrocede exactamente doce años", () => {
    fc.assert(
      fc.property(monthDate, fc.constantFrom(-1 as const, 1 as const), (date, direction) => {
        const shifted = shiftCalendarView(date, "years", direction);
        expect(shifted.getFullYear() - date.getFullYear()).toBe(direction * 12);
        expect(shifted.getMonth()).toBe(date.getMonth());
      })
    );
  });

  it("parseDateValue rechaza cadenas vacías y textos que no son fechas", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-zA-Z ]{1,20}$/), (value) => {
        expect(parseDateValue(value)).toBeNull();
      })
    );
    expect(parseDateValue(undefined)).toBeNull();
    expect(parseDateValue("")).toBeNull();
  });
});
