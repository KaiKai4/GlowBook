export type PricingMode = "fixed" | "variable";

export function isPricingMode(value: unknown): value is PricingMode {
  return value === "fixed" || value === "variable";
}

export function roundCurrency(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function clampDiscountPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function calculateDiscountAmount(subtotal: number, discountPercentage: number): number {
  return roundCurrency(roundCurrency(subtotal) * (clampDiscountPercentage(discountPercentage) / 100));
}

export function calculateFinalChargedTotal(subtotal: number, discountAmount: number): number {
  return roundCurrency(Math.max(0, roundCurrency(subtotal) - roundCurrency(discountAmount)));
}
