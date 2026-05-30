import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileWithRole } from "@/types/app.types";
import { findDashboardShellSalon } from "../data/salon.repo";
import { getDashboardShell } from "./get-dashboard-shell";

vi.mock("../data/salon.repo", () => ({
  findDashboardShellSalon: vi.fn(),
}));

const mockedFindDashboardShellSalon = vi.mocked(findDashboardShellSalon);

const profile: ProfileWithRole = {
  id: "profile-1",
  salon_id: "salon-1",
  role_id: null,
  is_owner: true,
  full_name: "Owner",
  is_active: true,
  salon: null,
  role: null,
};

describe("get dashboard shell", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns shell access and applies salon feature flags", async () => {
    mockedFindDashboardShellSalon.mockResolvedValue({
      name: "Glow Studio",
      is_active: true,
      theme: "",
      bg_style: null,
      disabled_features: ["reports", "unknown"],
    } as never);

    const view = await getDashboardShell(profile);

    expect(mockedFindDashboardShellSalon).toHaveBeenCalledWith("salon-1");
    expect(view).toMatchObject({
      salonName: "Glow Studio",
      isActive: true,
      theme: "violet",
      bgStyle: "neutral",
      disabledFeatures: ["reports"],
    });
    expect(view?.permissions).not.toContain("reports.view");
  });

  it("returns null when the salon cannot be loaded", async () => {
    mockedFindDashboardShellSalon.mockResolvedValue(null);

    await expect(getDashboardShell(profile)).resolves.toBeNull();
  });
});
