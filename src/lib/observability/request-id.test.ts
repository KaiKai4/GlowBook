import { describe, expect, it } from "vitest";
import { isValidRequestId, resolveRequestId } from "./request-id";

const VALID = "3f2c1a9e-5b7d-4c8e-9a0b-1d2e3f4a5b6c";

describe("request id", () => {
  it("accepts a well-formed UUID", () => {
    expect(isValidRequestId(VALID)).toBe(true);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["not a uuid", "abc"],
    ["with newline injection", `${VALID}\nset-cookie: x`],
    ["uuid with extra characters", `${VALID}0`],
  ])("rejects an incoming id that is %s", (_label, value) => {
    expect(isValidRequestId(value)).toBe(false);
  });

  it("reuses a valid incoming id", () => {
    expect(resolveRequestId(VALID)).toBe(VALID);
  });

  it("generates a new UUID when the incoming id is invalid", () => {
    const generated = resolveRequestId("no-valido");

    expect(isValidRequestId(generated)).toBe(true);
    expect(generated).not.toBe("no-valido");
  });

  it("generates different ids for different requests", () => {
    expect(resolveRequestId(null)).not.toBe(resolveRequestId(null));
  });
});
