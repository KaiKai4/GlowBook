import { describe, expect, it } from "vitest";
import { formatCompactNumber, formatCurrency, roundCurrency, toAmount } from "./money";

describe("roundCurrency", () => {
  it("redondea a dos decimales", () => {
    expect(roundCurrency(12.345)).toBe(12.35);
    expect(roundCurrency(12.344)).toBe(12.34);
  });

  it("corrige el error de coma flotante en valores de medio centavo", () => {
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(2.675)).toBe(2.68);
  });

  it("acepta cero y negativos sin distorsión", () => {
    expect(roundCurrency(0)).toBe(0);
    expect(roundCurrency(-1.234)).toBe(-1.23);
  });

  it("es idempotente", () => {
    const once = roundCurrency(33.333);
    expect(roundCurrency(once)).toBe(once);
  });
});

describe("formatCurrency", () => {
  it("formatea en dólares con separador es-PA", () => {
    const text = formatCurrency(1234.5);
    expect(text).toContain("1");
    expect(text).toContain("234");
    expect(text).toMatch(/\.50|,50/);
  });
});

describe("toAmount", () => {
  it("convierte cadenas numéricas de la BD", () => {
    expect(toAmount("12.50")).toBe(12.5);
  });

  it("convierte null y undefined en cero", () => {
    expect(toAmount(null)).toBe(0);
    expect(toAmount(undefined)).toBe(0);
  });

  it("mantiene los números tal cual", () => {
    expect(toAmount(7)).toBe(7);
  });

  it("devuelve NaN para cadenas no numéricas, igual que Number()", () => {
    expect(toAmount("abc")).toBeNaN();
  });
});

describe("formatCompactNumber", () => {
  it("no abrevia los valores menores de mil", () => {
    expect(formatCompactNumber(999)).toBe("999");
  });

  it("abrevia los valores desde mil", () => {
    expect(formatCompactNumber(1500)).not.toBe("1500");
    expect(formatCompactNumber(1500)).toContain("1");
  });
});
