import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  formatTimeValue,
  isTimeWithinRange,
  parseTimeValue,
  resolvePeriodForRange,
  toTimeValue,
  type TimeParts,
} from "./time-picker-utils";

const pad = (value: number) => String(value).padStart(2, "0");

const hhmm = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([hour, minute]) => `${pad(hour)}:${pad(minute)}`);

const timeParts: fc.Arbitrary<TimeParts> = fc
  .record({
    hour: fc.integer({ min: 1, max: 12 }),
    minute: fc.integer({ min: 0, max: 59 }),
    period: fc.constantFrom("AM" as const, "PM" as const),
  });

describe("time picker utils (propiedades)", () => {
  it("convertir a partes de 12 horas y volver conserva cualquier hora válida del día", () => {
    fc.assert(
      fc.property(hhmm, (value) => {
        expect(toTimeValue(parseTimeValue(value))).toBe(value);
      })
    );
  });

  it("las partes de 12 horas están siempre en el rango 1-12 y el periodo coincide con la hora de 24 horas", () => {
    fc.assert(
      fc.property(hhmm, (value) => {
        const parts = parseTimeValue(value);
        const hour24 = Number(value.slice(0, 2));

        expect(parts.hour).toBeGreaterThanOrEqual(1);
        expect(parts.hour).toBeLessThanOrEqual(12);
        expect(parts.period).toBe(hour24 >= 12 ? "PM" : "AM");
        expect(parts.minute).toBe(Number(value.slice(3)));
      })
    );
  });

  it("formatTimeValue nunca muestra hora 0 y siempre usa dos dígitos en los minutos", () => {
    fc.assert(
      fc.property(hhmm, (value) => {
        const formatted = formatTimeValue(value);

        expect(formatted).toMatch(/^([1-9]|1[0-2]):[0-5]\d (a\. m\.|p\. m\.)$/);
      })
    );
  });

  it("un valor dentro de [min, max] siempre es válido, y uno fuera nunca lo es", () => {
    fc.assert(
      fc.property(hhmm, hhmm, hhmm, (a, b, value) => {
        const [min, max] = a <= b ? [a, b] : [b, a];
        const inside = value >= min && value <= max;

        expect(isTimeWithinRange(value, min, max)).toBe(inside);
      })
    );
  });

  it("con máximo exclusivo, la hora igual al máximo queda fuera", () => {
    fc.assert(
      fc.property(hhmm, hhmm, (min, max) => {
        expect(isTimeWithinRange(max, min, max, true)).toBe(false);
        // Con min === max el rango exclusivo queda vacío: solo se exige para min < max.
        if (min < max) expect(isTimeWithinRange(min, min, max, true)).toBe(true);
      })
    );
  });

  it("sin límites cualquier hora es válida", () => {
    fc.assert(
      fc.property(hhmm, (value) => {
        expect(isTimeWithinRange(value)).toBe(true);
      })
    );
  });

  it("sin límites el periodo resuelto es el que ya tenían las partes", () => {
    fc.assert(
      fc.property(timeParts, (parts) => {
        expect(resolvePeriodForRange(parts)).toBe(parts.period);
      })
    );
  });

  it("si el periodo elegido ya es válido, se conserva", () => {
    fc.assert(
      fc.property(timeParts, (parts) => {
        const min = "00:00";
        const max = "23:59";
        expect(resolvePeriodForRange(parts, min, max)).toBe(parts.period);
      })
    );
  });

  it("si solo uno de los periodos cae en el horario, se elige ese", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 0, max: 59 }), (hour, minute) => {
        // Horario estrictamente de tarde: 13:00 a 17:59. Solo PM puede caer dentro.
        const parts: TimeParts = { hour, minute, period: "AM" };
        const resolved = resolvePeriodForRange(parts, "13:00", "17:59");
        const pmValue = toTimeValue({ hour, minute, period: "PM" });
        const amValue = toTimeValue({ hour, minute, period: "AM" });
        const pmValid = isTimeWithinRange(pmValue, "13:00", "17:59");
        const amValid = isTimeWithinRange(amValue, "13:00", "17:59");

        if (pmValid && !amValid) expect(resolved).toBe("PM");
        if (amValid && !pmValid) expect(resolved).toBe("AM");
      })
    );
  });
});
