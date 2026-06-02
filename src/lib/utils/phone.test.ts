import { describe, expect, it } from "vitest";
import { isValidOptionalPhone, normalizeOptionalPhoneInput, phoneDigits } from "./phone";

describe("phone utils", () => {
  it("allows empty optional phone values", () => {
    expect(isValidOptionalPhone(undefined)).toBe(true);
    expect(isValidOptionalPhone(null)).toBe(true);
    expect(isValidOptionalPhone("")).toBe(true);
  });

  it("rejects incomplete or non-mobile phone numbers", () => {
    expect(isValidOptionalPhone("123")).toBe(false);
    expect(isValidOptionalPhone("+507 600")).toBe(false);
    expect(isValidOptionalPhone("45123698")).toBe(false);
    expect(isValidOptionalPhone("71234567")).toBe(false);
  });

  it("accepts local and international Panama mobile numbers", () => {
    expect(isValidOptionalPhone("6000-0000")).toBe(true);
    expect(isValidOptionalPhone("+507 6000-0000")).toBe(true);
  });

  it("normalizes Panama mobile input for storage and form state", () => {
    expect(normalizeOptionalPhoneInput("+507 6479-5213")).toBe("64795213");
    expect(normalizeOptionalPhoneInput("647952132")).toBe("64795213");
  });

  it("extracts only digits", () => {
    expect(phoneDigits("+507 6000-0000")).toBe("50760000000");
  });
});
