import { describe, expect, it } from "vitest";
import { RATE_LIMIT_POLICIES, SIGN_IN_ACCOUNT_POLICY, SIGN_IN_IP_POLICY } from "./rate-limit-policies";

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

  it("el límite de inicio de sesion por cuenta es más estricto que el global, con la misma ventana", () => {
    expect(SIGN_IN_ACCOUNT_POLICY).toEqual({ max: 10, windowMs: 900_000, failMode: "closed" });
    expect(SIGN_IN_IP_POLICY).toEqual({ max: 100, windowMs: 900_000, failMode: "closed" });
  });
});
