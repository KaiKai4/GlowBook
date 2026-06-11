import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  deriveAssignmentSchedule,
  derivePaymentPeriod,
  todayIso,
} from "./assignment-schedule";

describe("deriveAssignmentSchedule", () => {
  it("calculates trial end from today + trial days when status is trialing", () => {
    const schedule = deriveAssignmentSchedule({
      status: "trialing",
      trialDays: 14,
      today: "2026-06-10",
    });

    expect(schedule.startsAt).toBe("2026-06-10");
    expect(schedule.trialEndsAt).toBe("2026-06-24");
  });

  it("has no trial end when the plan offers no trial days", () => {
    const schedule = deriveAssignmentSchedule({
      status: "trialing",
      trialDays: 0,
      today: "2026-06-10",
    });

    expect(schedule.trialEndsAt).toBeNull();
  });

  it("has no trial end when status is active", () => {
    const schedule = deriveAssignmentSchedule({
      status: "active",
      trialDays: 14,
      today: "2026-06-10",
    });

    expect(schedule.startsAt).toBe("2026-06-10");
    expect(schedule.trialEndsAt).toBeNull();
  });

  it("keeps the existing start date instead of resetting to today", () => {
    const schedule = deriveAssignmentSchedule({
      status: "trialing",
      trialDays: 7,
      today: "2026-06-10",
      existingStartsAt: "2026-06-01",
    });

    expect(schedule.startsAt).toBe("2026-06-01");
    expect(schedule.trialEndsAt).toBe("2026-06-08");
  });

  it("crosses month boundaries correctly", () => {
    expect(addDays("2026-06-25", 14)).toBe("2026-07-09");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });
});

describe("derivePaymentPeriod", () => {
  it("starts the month at the payment date when there is no current period", () => {
    const period = derivePaymentPeriod({ paidAt: "2026-06-11" });
    expect(period).toEqual({ periodStart: "2026-06-11", periodEnd: "2026-07-11" });
  });

  it("chains to the current period end when paying in advance", () => {
    const period = derivePaymentPeriod({ paidAt: "2026-06-20", currentPeriodEnd: "2026-07-11" });
    expect(period).toEqual({ periodStart: "2026-07-11", periodEnd: "2026-08-11" });
  });

  it("restarts from the payment date when the previous period already expired", () => {
    const period = derivePaymentPeriod({ paidAt: "2026-08-03", currentPeriodEnd: "2026-07-11" });
    expect(period).toEqual({ periodStart: "2026-08-03", periodEnd: "2026-09-03" });
  });
});

describe("addMonths", () => {
  it("clamps to the last day of shorter months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-08-31", 1)).toBe("2026-09-30");
  });

  it("crosses year boundaries", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("todayIso", () => {
  it("returns a YYYY-MM-DD string for the reference date", () => {
    expect(todayIso(new Date("2026-06-10T18:30:00Z"))).toBe("2026-06-10");
  });
});
