import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BusinessHoursSchema,
  SalonInfoSchema,
  SalonPaymentMethodsSchema,
} from "./schemas";

function closedDay(dayOfWeek: number) {
  return { day_of_week: dayOfWeek, is_open: false, open_time: null, close_time: null };
}

function weekOf(overrides: Record<number, object> = {}) {
  return Array.from({ length: 7 }, (_, day) => ({ ...closedDay(day), ...overrides[day] }));
}

describe("salón schemas", () => {
  describe("SalonInfoSchema", () => {
    it("acepta un nombre de 1 a 120 caracteres", () => {
      expect(SalonInfoSchema.safeParse({ name: "G" }).success).toBe(true);
      expect(SalonInfoSchema.safeParse({ name: "a".repeat(120) }).success).toBe(true);
    });

    it("rechaza nombre vacio o demasiado largo con mensaje de dominio", () => {
      const empty = SalonInfoSchema.safeParse({ name: "" });
      expect(empty.success).toBe(false);
      expect(empty.error?.issues[0]?.message).toBe("El nombre del salón es obligatorio");

      expect(SalonInfoSchema.safeParse({ name: "a".repeat(121) }).success).toBe(false);
    });
  });

  describe("SalonPaymentMethodsSchema", () => {
    it("recorta, normaliza espacios y elimina duplicados sin distinguir mayusculas", () => {
      const parsed = SalonPaymentMethodsSchema.safeParse(["  Tarjeta   Débito ", "tarjeta débito", "Yappy"]);

      expect(parsed).toEqual({ success: true, data: ["Tarjeta Débito", "Yappy"] });
    });

    it("exige al menos un método de pago", () => {
      const result = SalonPaymentMethodsSchema.safeParse([]);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Agrega al menos un método de pago.");
    });

    it("rechaza métodos vacios tras recortar y métodos de más de 64 caracteres", () => {
      const blank = SalonPaymentMethodsSchema.safeParse(["   "]);
      expect(blank.success).toBe(false);
      expect(blank.error?.issues[0]?.message).toBe("El método de pago es obligatorio.");

      const tooLong = SalonPaymentMethodsSchema.safeParse(["x".repeat(65)]);
      expect(tooLong.success).toBe(false);
      expect(tooLong.error?.issues[0]?.message).toBe("El método de pago no puede superar 64 caracteres.");
    });
  });

  describe("BusinessHoursSchema", () => {
    it("acepta exactamente siete días con horario abierto válido o cerrado", () => {
      const week = weekOf({
        1: { is_open: true, open_time: "09:00", close_time: "18:30" },
      });

      expect(BusinessHoursSchema.safeParse(week).success).toBe(true);
    });

    it("rechaza semanas con menos o más de siete días", () => {
      expect(BusinessHoursSchema.safeParse(weekOf().slice(0, 6)).success).toBe(false);
      expect(BusinessHoursSchema.safeParse([...weekOf(), closedDay(0)]).success).toBe(false);
    });

    it("exige que la hora de cierre sea mayor que la de apertura en días abiertos", () => {
      const result = BusinessHoursSchema.safeParse(
        weekOf({ 2: { is_open: true, open_time: "18:00", close_time: "09:00" } })
      );

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual([2, "close_time"]);
      expect(result.error?.issues[0]?.message).toBe("La hora de cierre debe ser mayor que la de apertura.");
    });

    it("rechaza días abiertos sin horas y horas con formato inválido", () => {
      expect(
        BusinessHoursSchema.safeParse(weekOf({ 0: { is_open: true, open_time: null, close_time: "18:00" } })).success
      ).toBe(false);
      expect(
        BusinessHoursSchema.safeParse(weekOf({ 0: { is_open: true, open_time: "9:00", close_time: "18:00" } })).success
      ).toBe(false);
      expect(
        BusinessHoursSchema.safeParse(weekOf({ 0: { is_open: true, open_time: "24:00", close_time: "23:59" } })).success
      ).toBe(false);
    });

    it("rechaza un día de la semana fuera de 0..6", () => {
      const week = weekOf();
      week[6] = { ...closedDay(7) };

      expect(BusinessHoursSchema.safeParse(week).success).toBe(false);
    });

    it("propiedad: un día abierto es válido exactamente cuando la apertura es anterior al cierre", () => {
      const minutesOfDay = fc.integer({ min: 0, max: 24 * 60 - 1 });
      const toHHMM = (minutes: number) =>
        `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

      fc.assert(
        fc.property(minutesOfDay, minutesOfDay, (open, close) => {
          const result = BusinessHoursSchema.safeParse(
            weekOf({ 3: { is_open: true, open_time: toHHMM(open), close_time: toHHMM(close) } })
          );

          expect(result.success).toBe(open < close);
        })
      );
    });
  });
});
