import { describe, expect, it } from "vitest";
import {
  calculateDiscountAmount,
  calculateFinalChargedTotal,
  clampDiscountPercentage,
  roundCurrency,
} from "./pricing";

describe("appointment pricing", () => {
  it("rounds currency and clamps discount percentage", () => {
    expect(roundCurrency(10.005)).toBe(10.01);
    expect(clampDiscountPercentage(-5)).toBe(0);
    expect(clampDiscountPercentage(125)).toBe(100);
  });

  it("keeps total charged as subtotal minus service-level discounts", () => {
    const subtotal = 60;
    const discount = calculateDiscountAmount(subtotal, 10);

    expect(discount).toBe(6);
    expect(calculateFinalChargedTotal(subtotal, discount)).toBe(54);
  });
});
