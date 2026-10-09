// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { makeMetric, makePlan } from "@/test/ui-admin-fixtures";
import { PlanLimits } from "./plan-sections";

vi.mock("./actions", () => ({
  savePlanAction: vi.fn(),
  savePlanModulesAction: vi.fn(),
  savePlanLimitsAction: vi.fn(),
}));

describe("PlanLimits (módulo sin catálogo)", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("si el módulo activo no está en el catálogo, su título usa la clave del módulo", () => {
    const plan = makePlan({
      modules: [{ moduleKey: "appointments", enabled: true }],
      limits: [],
    });
    mounted = mountComponent(
      <PlanLimits
        plan={plan}
        modules={[]}
        metrics={[makeMetric({ key: "appointments_monthly", moduleKey: "appointments", name: "Citas" })]}
      />
    );

    expect(mounted.container.querySelector("h3")?.textContent).toBe("appointments");
  });
});
