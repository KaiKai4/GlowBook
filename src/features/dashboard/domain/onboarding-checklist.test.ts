import { describe, expect, it } from "vitest";
import { buildOnboardingChecklist } from "./onboarding-checklist";

describe("onboarding checklist", () => {
  it("marks steps done based on counts and reports progress", () => {
    const checklist = buildOnboardingChecklist({
      services: 3,
      employees: 1,
      customers: 0,
      appointments: 0,
    });

    expect(checklist.doneCount).toBe(2);
    expect(checklist.complete).toBe(false);
    expect(checklist.steps.map((step) => step.done)).toEqual([true, true, false, false]);
  });

  it("is complete when every count is positive", () => {
    const checklist = buildOnboardingChecklist({
      services: 1,
      employees: 1,
      customers: 1,
      appointments: 1,
    });

    expect(checklist.complete).toBe(true);
    expect(checklist.doneCount).toBe(4);
  });
});
