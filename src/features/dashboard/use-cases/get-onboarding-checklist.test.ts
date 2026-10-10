import { beforeEach, describe, expect, it, vi } from "vitest";
import { findOnboardingCounts } from "../data/onboarding.repo";
import { getOnboardingChecklist } from "./get-onboarding-checklist";

vi.mock("../data/onboarding.repo", () => ({
  findOnboardingCounts: vi.fn(),
}));

const mockedFindCounts = vi.mocked(findOnboardingCounts);

describe("getOnboardingChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta los conteos del salón y marca como hechos solo los pasos con datos", async () => {
    mockedFindCounts.mockResolvedValue({ services: 3, employees: 0, customers: 5, appointments: 0 });

    const checklist = await getOnboardingChecklist("salon-1");

    expect(mockedFindCounts).toHaveBeenCalledWith("salon-1");
    expect(checklist.doneCount).toBe(2);
    expect(checklist.complete).toBe(false);
    expect(checklist.steps.map((step) => [step.key, step.done])).toEqual([
      ["services", true],
      ["employees", false],
      ["customers", true],
      ["appointments", false],
    ]);
  });

  it("queda completo cuando todos los conteos son mayores que cero", async () => {
    mockedFindCounts.mockResolvedValue({ services: 1, employees: 1, customers: 1, appointments: 1 });

    const checklist = await getOnboardingChecklist("salon-1");

    expect(checklist).toMatchObject({ doneCount: 4, complete: true });
  });

  it("muestra todos los pasos pendientes cuando el salón esta vacio", async () => {
    mockedFindCounts.mockResolvedValue({ services: 0, employees: 0, customers: 0, appointments: 0 });

    const checklist = await getOnboardingChecklist("salon-1");

    expect(checklist).toMatchObject({ doneCount: 0, complete: false });
    expect(checklist.steps.every((step) => !step.done)).toBe(true);
  });
});
