import { describe, expect, it } from "vitest";
import { isValidOptionalPhone, phoneDigits } from "./phone";

describe("phone utils", () => {
  it("allows empty optional phone values", () => {
    expect(isValidOptionalPhone(undefined)).toBe(true);
    expect(isValidOptionalPhone(null)).toBe(true);
    expect(isValidOptionalPhone("")).toBe(true);
  });

  it("rejects incomplete phone numbers", () => {
    expect(isValidOptionalPhone("123")).toBe(false);
    expect(isValidOptionalPhone("+507 600")).toBe(false);
  });

  it("accepts local and international phone numbers", () => {
    expect(isValidOptionalPhone("6000-0000")).toBe(true);
    expect(isValidOptionalPhone("+507 6000-0000")).toBe(true);
  });

  it("extracts only digits", () => {
    expect(phoneDigits("+507 6000-0000")).toBe("50760000000");
  });
});
