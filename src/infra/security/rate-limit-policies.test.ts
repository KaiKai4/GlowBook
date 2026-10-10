import { describe, expect, it } from "vitest";
import { RATE_LIMIT_POLICIES } from "./rate-limit-policies";

describe("RATE_LIMIT_POLICIES", () => {
  it("todas las politicas tienen máximo y ventana positivos", () => {
    for (const policy of Object.values(RATE_LIMIT_POLICIES)) {
      expect(policy.max).toBeGreaterThan(0);
      expect(policy.windowMs).toBeGreaterThan(0);
    }
  });

  it("la politica de escritura es más permisiva que la restringida", () => {
    expect(RATE_LIMIT_POLICIES.write.max).toBeGreaterThan(RATE_LIMIT_POLICIES.restricted.max);
  });
});
