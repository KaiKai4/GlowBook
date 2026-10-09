import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import type { EffectiveSalonPlan } from "../domain/commercial-plan";
import { readEffectivePlanOrNull } from "./effective-plan-fallback";

vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const mockedCapture = vi.mocked(captureError);
const PLAN = { salonId: "salon-1", plan: null } as unknown as EffectiveSalonPlan;

describe("readEffectivePlanOrNull", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("devuelve el plan efectivo cuando la lectura funciona", async () => {
    const load = vi.fn().mockResolvedValue(PLAN);

    expect(await readEffectivePlanOrNull("salon-1", "module-enabled", load)).toBe(PLAN);
    expect(load).toHaveBeenCalledWith("salon-1");
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it("si la lectura falla devuelve null y registra el error con la acción", async () => {
    const failure = new Error("caida");
    const load = vi.fn().mockRejectedValue(failure);

    expect(await readEffectivePlanOrNull("salon-1", "module-enabled", load)).toBeNull();
    expect(mockedCapture).toHaveBeenCalledWith(failure, {
      module: "billing",
      action: "module-enabled",
      metadata: { effect: "plan efectivo" },
    });
  });
});
