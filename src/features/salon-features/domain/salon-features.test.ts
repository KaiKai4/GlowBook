import { describe, expect, it } from "vitest";
import {
  isSalonFeatureDisabled,
  normalizeDisabledSalonFeatures,
} from "./salon-features";

describe("salón features", () => {
  it("normalizes disabled feature keys and drops unknown values", () => {
    expect(
      normalizeDisabledSalonFeatures(["roles", "plantillas", "roles", "unknown"])
    ).toEqual(["roles", "plantillas"]);
  });

  it("checks disabled features using the normalized contract", () => {
    expect(isSalonFeatureDisabled(["reports", "legacy"], "reports")).toBe(true);
    expect(isSalonFeatureDisabled(["reports", "legacy"], "services")).toBe(false);
  });
});
