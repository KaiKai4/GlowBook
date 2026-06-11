import { describe, expect, it } from "vitest";
import { evaluatePaymentStanding } from "./payment-standing";

describe("payment standing", () => {
  it("is ok while the paid period is current", () => {
    const standing = evaluatePaymentStanding({
      status: "active",
      currentPeriodEnd: "2026-06-30",
      trialEndsAt: null,
      todayIso: "2026-06-11",
    });

    expect(standing.state).toBe("ok");
  });

  it("enters grace right after the paid period expires", () => {
    const standing = evaluatePaymentStanding({
      status: "active",
      currentPeriodEnd: "2026-06-10",
      trialEndsAt: null,
      todayIso: "2026-06-12",
    });

    expect(standing).toEqual({ state: "grace", overdueSince: "2026-06-10", graceDaysLeft: 3 });
  });

  it("suspends once the grace window is exhausted", () => {
    const standing = evaluatePaymentStanding({
      status: "active",
      currentPeriodEnd: "2026-06-01",
      trialEndsAt: null,
      todayIso: "2026-06-11",
    });

    expect(standing.state).toBe("suspended");
    expect(standing.overdueSince).toBe("2026-06-01");
  });

  it("applies the same rule to expired trials", () => {
    const grace = evaluatePaymentStanding({
      status: "trialing",
      currentPeriodEnd: null,
      trialEndsAt: "2026-06-09",
      todayIso: "2026-06-11",
    });
    const suspended = evaluatePaymentStanding({
      status: "trialing",
      currentPeriodEnd: null,
      trialEndsAt: "2026-06-01",
      todayIso: "2026-06-11",
    });

    expect(grace.state).toBe("grace");
    expect(suspended.state).toBe("suspended");
  });

  it("ignores salons without plan or with paused/canceled assignments", () => {
    expect(
      evaluatePaymentStanding({
        status: null,
        currentPeriodEnd: "2026-01-01",
        trialEndsAt: null,
        todayIso: "2026-06-11",
      }).state
    ).toBe("ok");
    expect(
      evaluatePaymentStanding({
        status: "paused",
        currentPeriodEnd: "2026-01-01",
        trialEndsAt: null,
        todayIso: "2026-06-11",
      }).state
    ).toBe("ok");
  });

  it("stays ok when there is no deadline to compare against", () => {
    expect(
      evaluatePaymentStanding({
        status: "active",
        currentPeriodEnd: null,
        trialEndsAt: null,
        todayIso: "2026-06-11",
      }).state
    ).toBe("ok");
  });
});
