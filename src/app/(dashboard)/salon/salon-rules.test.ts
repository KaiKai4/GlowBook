import { describe, expect, it } from "vitest";
import { firstHoursError, validateNewPaymentMethod, type HoursDay } from "./salon-rules";

function day(day_of_week: number, overrides: Partial<HoursDay> = {}): HoursDay {
  return { day_of_week, is_open: true, open_time: "09:00", close_time: "18:00", ...overrides };
}

describe("firstHoursError", () => {
  it("acepta horarios donde el cierre es posterior a la apertura", () => {
    expect(firstHoursError([day(0), day(1, { is_open: false, open_time: "18:00", close_time: "09:00" })])).toBeNull();
  });

  it("señala el primer día abierto con cierre no posterior a la apertura", () => {
    const hours = [day(0), day(1, { open_time: "18:00", close_time: "18:00" }), day(2, { open_time: "20:00", close_time: "08:00" })];
    expect(firstHoursError(hours)).toBe("Martes: la hora de cierre debe ser mayor que la de apertura.");
  });

  it("nombra el día con la etiqueta recibida", () => {
    expect(firstHoursError([day(3, { open_time: "10:00", close_time: "10:00" })], ["a", "b", "c", "Jueves"])).toBe(
      "Jueves: la hora de cierre debe ser mayor que la de apertura."
    );
  });
});

describe("validateNewPaymentMethod", () => {
  it("rechaza un valor vacío o solo con espacios", () => {
    expect(validateNewPaymentMethod("   ", [])).toEqual({ ok: false, error: "Escribe un metodo de pago." });
  });

  it("acepta hasta 64 caracteres y rechaza más", () => {
    expect(validateNewPaymentMethod("a".repeat(64), []).ok).toBe(true);
    expect(validateNewPaymentMethod("a".repeat(65), [])).toEqual({
      ok: false,
      error: "El metodo de pago no puede superar 64 caracteres.",
    });
  });

  it("rechaza duplicados sin distinguir mayúsculas", () => {
    expect(validateNewPaymentMethod("ZINLI", ["zinli"])).toEqual({
      ok: false,
      error: "Ese metodo de pago ya esta en la lista.",
    });
  });

  it("devuelve el método normalizado con espacios colapsados", () => {
    expect(validateNewPaymentMethod("  Pago   Zinli ", ["Efectivo"])).toEqual({ ok: true, method: "Pago Zinli" });
  });
});
