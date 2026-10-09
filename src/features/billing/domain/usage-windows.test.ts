import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scopeWindow, type UsageCycleAssignment } from "./usage-windows";

const assignment = (overrides: Partial<UsageCycleAssignment> = {}): UsageCycleAssignment => ({
  starts_at: null,
  current_period_start: null,
  current_period_end: null,
  ...overrides,
});

describe("scopeWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("current y lifetime no acotan por fechas", () => {
    expect(scopeWindow("current", assignment())).toEqual([null, null]);
    expect(scopeWindow("lifetime", assignment())).toEqual([null, null]);
  });

  it("monthly usa el mes calendario en UTC", () => {
    expect(scopeWindow("monthly", assignment())).toEqual([
      "2026-03-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
    ]);
  });

  it("billing_cycle usa el periodo pagado cuando existe", () => {
    expect(
      scopeWindow(
        "billing_cycle",
        assignment({ current_period_start: "2026-03-10", current_period_end: "2026-04-10" })
      )
    ).toEqual(["2026-03-10T00:00:00.000Z", "2026-04-10T00:00:00.000Z"]);
  });

  it("billing_cycle sin periodo ancla al día de inicio de la asignación", () => {
    expect(scopeWindow("billing_cycle", assignment({ starts_at: "2026-01-20" }))).toEqual([
      "2026-02-20T00:00:00.000Z",
      "2026-03-20T00:00:00.000Z",
    ]);
  });

  it("billing_cycle sin asignación cae al mes calendario", () => {
    expect(scopeWindow("billing_cycle", null)).toEqual(scopeWindow("monthly", null));
  });

  it("el día ancla 31 se ajusta al último día de los meses cortos", () => {
    expect(scopeWindow("billing_cycle", assignment({ starts_at: "2026-01-31" }))).toEqual([
      "2026-02-28T00:00:00.000Z",
      "2026-03-31T00:00:00.000Z",
    ]);
  });
});
