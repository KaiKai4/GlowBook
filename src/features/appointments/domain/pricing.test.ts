import { describe, expect, it } from "vitest";
import { roundCurrency } from "@/infra/format/money";
import { calculateItemChargedPrice, previewCompletionTotals } from "./pricing";

/** Descuento en moneda de un item, leído de la vista previa pública del cobro. */
const discountOf = (subtotal: number, pct: number): number =>
  previewCompletionTotals([{ id: "x", price: subtotal, discountPercentage: pct }]).discountAmount;

/** Porcentaje limpio de un item, leído de la vista previa pública del cobro. */
const clampOf = (pct: number): number => {
  const [line] = previewCompletionTotals([{ id: "x", price: 0, discountPercentage: pct }]).items;
  return line?.discountPercentage ?? 0;
};

describe("appointment pricing", () => {
  it("rounds currency and clamps discount percentage", () => {
    expect(roundCurrency(10.005)).toBe(10.01);
    expect(clampOf(-5)).toBe(0);
    expect(clampOf(125)).toBe(100);
  });

  it("keeps total charged as subtotal minus service-level discounts", () => {
    const subtotal = 60;
    const discount = discountOf(subtotal, 10);

    expect(discount).toBe(6);
    expect(calculateItemChargedPrice(subtotal, discount)).toBe(54);
  });

  it("redondea el precio cobrado de un item con descuento fraccionado", () => {
    // Antes se mostraba 13.3333 sin redondear; el importe cobrado es 13.33.
    expect(calculateItemChargedPrice(20, 6.6667)).toBe(13.33);
  });

  it("no deja el precio de un item en negativo", () => {
    expect(calculateItemChargedPrice(5, 9)).toBe(0);
  });

  it("calcula la vista previa del cobro por item y en total", () => {
    const preview = previewCompletionTotals([
      { id: "a", price: 33.33, discountPercentage: 10 },
      { id: "b", price: 10.005, discountPercentage: 0 },
    ]);

    expect(preview.items.map((line) => [line.id, line.discountAmount, line.finalPrice])).toEqual([
      ["a", 3.33, 30],
      ["b", 0, 10.01],
    ]);
    expect(preview.subtotal).toBe(43.34);
    expect(preview.discountAmount).toBe(3.33);
    expect(preview.finalTotal).toBe(40.01);
  });

  it("acota el porcentaje de descuento de la vista previa y conserva campos extra", () => {
    const preview = previewCompletionTotals([
      { id: "a", price: 20, discountPercentage: 150, isVariable: true },
    ]);

    expect(preview.items[0]).toMatchObject({ discountPercentage: 100, finalPrice: 0, isVariable: true });
    expect(preview.finalTotal).toBe(0);
  });

  it("redondea el descuento de la vista previa sin pasar del centavo", () => {
    // 10.01 * 15% = 1.5015 -> descuento 1.50 y cobro 8.51 (no 8.5085).
    const preview = previewCompletionTotals([{ id: "a", price: 10.01, discountPercentage: 15 }]);

    expect(preview.items).toEqual([expect.objectContaining({ discountAmount: 1.5, finalPrice: 8.51 })]);
  });
});
