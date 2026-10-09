import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  isPaymentMethodEnabled,
  normalizePaymentMethod,
  normalizePaymentMethods,
  paymentMethodLabel,
  paymentMethodOptionsFor,
  paymentMethodsOrDefaults,
} from "./payment-methods";

// Catálogo por defecto obtenido a través de la API pública (no exportado como constante).
const DEFAULT_PAYMENT_METHODS = paymentMethodsOrDefaults(null);
const DEFAULT_PAYMENT_METHOD_OPTIONS = paymentMethodOptionsFor(null);

describe("payment methods catalog", () => {
  it("exposes the default methods in catalog order", () => {
    expect(DEFAULT_PAYMENT_METHODS).toEqual(["cash", "card", "transfer", "yappy", "other"]);
    expect(DEFAULT_PAYMENT_METHOD_OPTIONS.map((option) => option.label)).toEqual([
      "Efectivo",
      "Tarjeta",
      "Transferencia",
      "Yappy",
      "Otro",
    ]);
  });
});

describe("normalizePaymentMethod", () => {
  it("trims and collapses internal whitespace without changing case", () => {
    expect(normalizePaymentMethod("  Pago   Movil  ")).toBe("Pago Movil");
    expect(normalizePaymentMethod("Cash")).toBe("Cash");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizePaymentMethod("   ")).toBe("");
  });
});

describe("normalizePaymentMethods", () => {
  it("drops blanks and keeps the first spelling of case-insensitive duplicates", () => {
    expect(normalizePaymentMethods(["Cash", " cash ", "", "CARD", "card", "  "])).toEqual([
      "Cash",
      "CARD",
    ]);
  });

  it("returns an empty list for null, undefined or empty input", () => {
    expect(normalizePaymentMethods(null)).toEqual([]);
    expect(normalizePaymentMethods(undefined)).toEqual([]);
    expect(normalizePaymentMethods([])).toEqual([]);
  });

  it("treats internal whitespace variants as the same method", () => {
    expect(normalizePaymentMethods(["Pago  Movil", "pago movil"])).toEqual(["Pago Movil"]);
  });

  it("property: result has no blanks, no case-insensitive duplicates and is a subset of trimmed inputs", () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 20 }), (values) => {
        const result = normalizePaymentMethods(values);
        const keys = result.map((value) => value.toLocaleLowerCase());

        expect(new Set(keys).size).toBe(keys.length);
        expect(result.every((value) => value.length > 0)).toBe(true);
        expect(result.every((value) => value === normalizePaymentMethod(value))).toBe(true);
      })
    );
  });
});

describe("paymentMethodsOrDefaults", () => {
  it("falls back to the defaults when nothing usable is configured", () => {
    expect(paymentMethodsOrDefaults(null)).toEqual(DEFAULT_PAYMENT_METHODS);
    expect(paymentMethodsOrDefaults([])).toEqual(DEFAULT_PAYMENT_METHODS);
    expect(paymentMethodsOrDefaults(["   ", ""])).toEqual(DEFAULT_PAYMENT_METHODS);
  });

  it("uses the configured methods when at least one is usable", () => {
    expect(paymentMethodsOrDefaults(["  Nequi ", "cash"])).toEqual(["Nequi", "cash"]);
  });
});

describe("paymentMethodLabel", () => {
  it("returns the Spanish label for default keys", () => {
    expect(paymentMethodLabel("yappy")).toBe("Yappy");
    expect(paymentMethodLabel("transfer")).toBe("Transferencia");
  });

  it("returns custom methods unchanged", () => {
    expect(paymentMethodLabel("Nequi")).toBe("Nequi");
  });

  it("resolves default keys regardless of case, like the enabled-method check", () => {
    expect(paymentMethodLabel("Cash")).toBe("Efectivo");
    expect(paymentMethodLabel("cash")).toBe("Efectivo");
  });
});

describe("paymentMethodOptionsFor", () => {
  it("maps configured methods to options with labels", () => {
    expect(paymentMethodOptionsFor(["cash", "Nequi"])).toEqual([
      { value: "cash", label: "Efectivo" },
      { value: "Nequi", label: "Nequi" },
    ]);
  });

  it("returns the default options when the salon has no configuration", () => {
    expect(paymentMethodOptionsFor(null)).toEqual(DEFAULT_PAYMENT_METHOD_OPTIONS);
  });
});

describe("isPaymentMethodEnabled", () => {
  it("matches methods case-insensitively and ignores surrounding whitespace", () => {
    expect(isPaymentMethodEnabled("  CASH ", ["cash", "card"])).toBe(true);
    expect(isPaymentMethodEnabled("Nequi", ["nequi"])).toBe(true);
  });

  it("reports disabled methods that are not in the enabled list", () => {
    expect(isPaymentMethodEnabled("transfer", ["cash", "card"])).toBe(false);
  });

  it("uses the default methods when the enabled list is empty or missing", () => {
    expect(isPaymentMethodEnabled("yappy", [])).toBe(true);
    expect(isPaymentMethodEnabled("yappy", null)).toBe(true);
    expect(isPaymentMethodEnabled("bitcoin", undefined)).toBe(false);
  });

  it("property: a method is enabled exactly when its normalized lowercase form is configured", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.array(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 6 }),
        (method, enabled) => {
          const usable = normalizePaymentMethods(enabled);
          const expected = usable.some(
            (value) =>
              value.toLocaleLowerCase() === normalizePaymentMethod(method).toLocaleLowerCase()
          );
          expect(isPaymentMethodEnabled(method, enabled)).toBe(
            usable.length > 0 ? expected : DEFAULT_PAYMENT_METHODS.includes(normalizePaymentMethod(method).toLocaleLowerCase())
          );
        }
      )
    );
  });
});
