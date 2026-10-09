import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  calculateDiscountAmount,
  calculateFinalChargedTotal,
  clampDiscountPercentage,
  isPricingMode,
  roundCurrency,
} from "./pricing";

const money = fc.double({ min: 0, max: 100_000, noNaN: true, noDefaultInfinity: true });
const percentage = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });

describe("appointment pricing: casos de borde", () => {
  it("acepta solo los modos de precio fijo o variable", () => {
    expect(isPricingMode("fixed")).toBe(true);
    expect(isPricingMode("variable")).toBe(true);
    expect(isPricingMode("Fixed")).toBe(false);
    expect(isPricingMode(null)).toBe(false);
    expect(isPricingMode(undefined)).toBe(false);
    expect(isPricingMode(1)).toBe(false);
  });

  it("trata porcentajes no finitos como descuento cero", () => {
    expect(clampDiscountPercentage(Number.NaN)).toBe(0);
    expect(clampDiscountPercentage(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampDiscountPercentage(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("no aplica descuento cuando el porcentaje no es finito", () => {
    expect(calculateDiscountAmount(80, Number.NaN)).toBe(0);
    expect(calculateDiscountAmount(80, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("limita el descuento al 100% del subtotal", () => {
    expect(calculateDiscountAmount(45.5, 250)).toBe(45.5);
  });

  it("redondea el descuento a centavos antes de aplicarlo", () => {
    // 33.33 * 15% = 4.9995 -> 5.00 (redondeo half-up de centavos)
    expect(calculateDiscountAmount(33.33, 15)).toBe(5);
  });

  it("nunca cobra un total negativo aunque el descuento supere el subtotal", () => {
    expect(calculateFinalChargedTotal(10, 25)).toBe(0);
  });

  it("redondea valores con medio centavo hacia arriba", () => {
    expect(roundCurrency(12.345)).toBe(12.35);
  });
});

describe("appointment pricing: propiedades", () => {
  it("el porcentaje limpio queda siempre dentro de 0 y 100", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: false }), (value) => {
        const clamped = clampDiscountPercentage(value);
        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(100);
      })
    );
  });

  it("limpiar un porcentaje ya limpio no lo cambia", () => {
    fc.assert(
      fc.property(percentage, (value) => {
        expect(clampDiscountPercentage(clampDiscountPercentage(value))).toBe(
          clampDiscountPercentage(value)
        );
      })
    );
  });

  it("el descuento nunca supera el subtotal ni es negativo", () => {
    fc.assert(
      fc.property(money, fc.double({ min: -50, max: 200, noNaN: true }), (subtotal, pct) => {
        const discount = calculateDiscountAmount(subtotal, pct);
        expect(discount).toBeGreaterThanOrEqual(0);
        expect(discount).toBeLessThanOrEqual(roundCurrency(subtotal));
      })
    );
  });

  it("subtotal = total cobrado + descuento cuando el descuento no excede el subtotal", () => {
    fc.assert(
      fc.property(money, percentage, (subtotal, pct) => {
        const discount = calculateDiscountAmount(subtotal, pct);
        const total = calculateFinalChargedTotal(subtotal, discount);
        expect(total).toBeGreaterThanOrEqual(0);
        expect(roundCurrency(total + discount)).toBe(roundCurrency(subtotal));
      })
    );
  });

  it("el total cobrado nunca es negativo, incluso con descuentos mayores al subtotal", () => {
    fc.assert(
      fc.property(money, money, (subtotal, discount) => {
        expect(calculateFinalChargedTotal(subtotal, discount)).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it("los valores monetarios redondeados tienen como máximo dos decimales", () => {
    fc.assert(
      fc.property(money, (value) => {
        const rounded = roundCurrency(value);
        expect(Math.abs(rounded * 100 - Math.round(rounded * 100))).toBeLessThan(1e-6);
      })
    );
  });
});
