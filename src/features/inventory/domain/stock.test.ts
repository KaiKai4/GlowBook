import { describe, expect, it } from "vitest";
import { stockStatus } from "./stock";

describe("inventory stock", () => {
  it("classifies stock status by minimum quantity", () => {
    expect(stockStatus(0, 3)).toBe("empty");
    expect(stockStatus(2, 3)).toBe("low");
    expect(stockStatus(4, 3)).toBe("ok");
  });
});
