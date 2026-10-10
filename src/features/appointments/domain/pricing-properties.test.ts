import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { roundCurrency } from "@/infra/format/money";
import { calculateItemChargedPrice, isPricingMode, previewCompletionTotals } from "./pricing";

/** Descuento en moneda de un item, leído de la vista previa pública del cobro. */
const discountOf = (subtotal: number, pct: number): number =>
  previewCompletionTotals([{ id: "x", price: subtotal, discountPercentage: pct }]).discountAmount;

/** Porcentaje limpio de un item, leído de la vista previa pública del cobro. */
const clampOf = (pct: number): number => {
  const [line] = previewCompletionTotals([{ id: "x", price: 0, discountPercentage: pct }]).items;
  return line?.discountPercentage ?? 0;
};

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
    expect(clampOf(Number.NaN)).toBe(0);
    expect(clampOf(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampOf(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("no aplica descuento cuando el porcentaje no es finito", () => {
    expect(discountOf(80, Number.NaN)).toBe(0);
    expect(discountOf(80, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("limita el descuento al 100% del subtotal", () => {
    expect(discountOf(45.5, 250)).toBe(45.5);
  });

  it("redondea el descuento a centavos antes de aplicarlo", () => {
    // 33.33 * 15% = 4.9995 -> 5.00 (redondeo half-up de centavos)
    expect(discountOf(33.33, 15)).toBe(5);
  });

  it("nunca cobra un total negativo aunque el descuento supere el subtotal", () => {
    expect(calculateItemChargedPrice(10, 25)).toBe(0);
  });

  it("redondea valores con medio centavo hacia arriba", () => {
    expect(roundCurrency(12.345)).toBe(12.35);
  });
});

describe("appointment pricing: propiedades", () => {
  it("el porcentaje limpio queda siempre dentro de 0 y 100", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: false }), (value) => {
        const clamped = clampOf(value);
        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(100);
      })
    );
  });

  it("limpiar un porcentaje ya limpio no lo cambia", () => {
    fc.assert(
      fc.property(percentage, (value) => {
        expect(clampOf(clampOf(value))).toBe(
          clampOf(value)
        );
      })
    );
  });

  it("el descuento nunca supera el subtotal ni es negativo", () => {
    fc.assert(
      fc.property(money, fc.double({ min: -50, max: 200, noNaN: true }), (subtotal, pct) => {
        const discount = discountOf(subtotal, pct);
        expect(discount).toBeGreaterThanOrEqual(0);
        expect(discount).toBeLessThanOrEqual(roundCurrency(subtotal));
      })
    );
  });

  it("subtotal = total cobrado + descuento cuando el descuento no excede el subtotal", () => {
    fc.assert(
      fc.property(money, percentage, (subtotal, pct) => {
        const discount = discountOf(subtotal, pct);
        const total = calculateItemChargedPrice(subtotal, discount);
        expect(total).toBeGreaterThanOrEqual(0);
        expect(roundCurrency(total + discount)).toBe(roundCurrency(subtotal));
      })
    );
  });

  it("el total cobrado nunca es negativo, incluso con descuentos mayores al subtotal", () => {
    fc.assert(
      fc.property(money, money, (subtotal, discount) => {
        expect(calculateItemChargedPrice(subtotal, discount)).toBeGreaterThanOrEqual(0);
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
