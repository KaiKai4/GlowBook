// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { addDays, todayIso } from "@/features/billing/domain/assignment-schedule";
import { plan } from "@/test/billing-plan-fixtures";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { useAssignPlanState, type SubscriptionAssignment } from "./use-assign-plan-state";

type Result = ReturnType<typeof useAssignPlanState>;

let mounted: MountedComponent | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** Monta un componente arnés que expone el valor del hook en `box.current`. */
function setup(assignment: SubscriptionAssignment, plans: ReturnType<typeof plan>[]) {
  const box: { current: Result | null } = { current: null };
  function Harness() {
    box.current = useAssignPlanState(assignment, plans);
    return null;
  }
  mounted = mountComponent(<Harness />);
  return box as { current: Result };
}

const TRIAL_PLAN = plan({ id: "plan-trial", trialDays: 14 });
const NO_TRIAL_PLAN = plan({ id: "plan-sin-trial", trialDays: 0 });

describe("useAssignPlanState", () => {
  it("sin asignación empieza hoy, en trial y sin plan elegido (sin fin de trial)", () => {
    const box = setup(null, [TRIAL_PLAN]);

    expect(box.current.planId).toBe("");
    expect(box.current.status).toBe("trialing");
    expect(box.current.startsAt).toBe(todayIso());
    expect(box.current.hasExistingStart).toBe(false);
    expect(box.current.trialEndsAt).toBeNull();
  });

  it("al elegir un plan con días de prueba calcula el fin del trial desde el inicio", () => {
    const box = setup(null, [TRIAL_PLAN]);

    act(() => box.current.setPlanId("plan-trial"));

    expect(box.current.selectedPlan?.id).toBe("plan-trial");
    expect(box.current.trialEndsAt).toBe(addDays(todayIso(), 14));
  });

  it("un plan sin días de prueba no genera fin de trial", () => {
    const box = setup(null, [NO_TRIAL_PLAN]);

    act(() => box.current.setPlanId("plan-sin-trial"));

    expect(box.current.trialEndsAt).toBeNull();
  });

  it("si el estado deja de ser trial no hay fin de trial, aunque el plan lo tenga", () => {
    const box = setup(null, [TRIAL_PLAN]);

    act(() => box.current.setPlanId("plan-trial"));
    act(() => box.current.setStatus("active"));

    expect(box.current.trialEndsAt).toBeNull();
  });

  it("una asignación existente conserva su fecha de inicio", () => {
    const box = setup(
      {
        planId: "plan-trial",
        status: "trialing",
        startsAt: "2026-01-05",
        endsAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        notes: "",
      },
      [TRIAL_PLAN],
    );

    expect(box.current.hasExistingStart).toBe(true);
    expect(box.current.startsAt).toBe("2026-01-05");
    expect(box.current.trialEndsAt).toBe(addDays("2026-01-05", 14));
  });
});
