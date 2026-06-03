import { describe, expect, it } from "vitest";
import { applyStockDelta, stockStatus } from "./stock";

describe("inventory stock", () => {
  it("applies positive and negative deltas without losing cents", () => {
    expect(applyStockDelta(3.25, 1.5)).toBe(4.75);
    expect(applyStockDelta(3.25, -1.25)).toBe(2);
  });

  it("blocks movements that would leave stock negative", () => {
    expect(() => applyStockDelta(1, -2)).toThrow("Stock insuficiente");
  });

  it("classifies stock status by minimum quantity", () => {
    expect(stockStatus(0, 3)).toBe("empty");
    expect(stockStatus(2, 3)).toBe("low");
    expect(stockStatus(4, 3)).toBe("ok");
  });
});
