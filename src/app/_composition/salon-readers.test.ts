import { describe, expect, it, vi } from "vitest";
import { getDashboardShell } from "@/features/salon/use-cases/get-dashboard-shell";
import { getCachedDashboardShell } from "./salon-readers";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("@/features/salon/use-cases/get-dashboard-shell", () => ({
  getDashboardShell: vi.fn(),
}));

describe("getCachedDashboardShell", () => {
  it("delega en el caso de uso con el perfil de la request y devuelve su resultado", async () => {
    const shell = { plan: "pro" };
    const profile = { id: "user-1" } as never;
    vi.mocked(getDashboardShell).mockResolvedValue(shell as never);

    await expect(getCachedDashboardShell(profile)).resolves.toBe(shell);
    expect(getDashboardShell).toHaveBeenCalledWith(profile);
  });
});
