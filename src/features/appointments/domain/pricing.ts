import { roundCurrency } from "@/infra/format/money";

export type PricingMode = "fixed" | "variable";

export function isPricingMode(value: unknown): value is PricingMode {
  return value === "fixed" || value === "variable";
}

function clampDiscountPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function calculateDiscountAmount(subtotal: number, discountPercentage: number): number {
  return roundCurrency(roundCurrency(subtotal) * (clampDiscountPercentage(discountPercentage) / 100));
}

function calculateFinalChargedTotal(subtotal: number, discountAmount: number): number {
  return roundCurrency(Math.max(0, roundCurrency(subtotal) - roundCurrency(discountAmount)));
}

/** Precio cobrado de un item: precio menos descuento, redondeado y nunca negativo. */
export function calculateItemChargedPrice(price: number, discount: number): number {
  return calculateFinalChargedTotal(price, discount);
}

export interface CompletionPreviewInput {
  id: string;
  price: number;
  discountPercentage: number;
}

interface CompletionPreviewLine extends CompletionPreviewInput {
  discountAmount: number;
  finalPrice: number;
}

export interface CompletionPreviewTotals<T extends CompletionPreviewInput> {
  items: Array<T & CompletionPreviewLine>;
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
}

/**
 * Vista previa del cobro al completar una cita. Solo orienta antes de cobrar: el servidor
 * recalcula precios y descuentos y su resultado es el que cuenta.
 */
export function previewCompletionTotals<T extends CompletionPreviewInput>(
  items: T[]
): CompletionPreviewTotals<T> {
  const lines = items.map((item) => {
    const price = roundCurrency(item.price);
    const discountPercentage = clampDiscountPercentage(item.discountPercentage);
    const discountAmount = calculateDiscountAmount(price, discountPercentage);
    const finalPrice = calculateItemChargedPrice(price, discountAmount);
    return { ...item, price, discountPercentage, discountAmount, finalPrice };
  });
  const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.price, 0));
  const discountAmount = roundCurrency(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  return {
    items: lines,
    subtotal,
    discountAmount,
    finalTotal: calculateFinalChargedTotal(subtotal, discountAmount),
  };
}
