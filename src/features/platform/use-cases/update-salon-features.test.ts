import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSalonDisabledFeatures } from "@/features/platform/data/salons.repo";
import { updateSalonFeatures } from "./update-salon-features";
import { recordPlatformAction } from "./platform-audit";

vi.mock("@/features/platform/data/salons.repo", () => ({
  setSalonDisabledFeatures: vi.fn(),
}));

vi.mock("./platform-audit", () => ({
  recordPlatformAction: vi.fn(),
}));

const mockedSetSalonDisabledFeatures = vi.mocked(setSalonDisabledFeatures);
const mockedRecordPlatformAction = vi.mocked(recordPlatformAction);
const actorUserId = "00000000-0000-4000-8000-000000000001";

describe("update salon features", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedSetSalonDisabledFeatures.mockResolvedValue(undefined);
  });

  it("normalizes disabled features and records the platform action", async () => {
    await expect(
      updateSalonFeatures({
        salonId: "salon-1",
        disabledFeatures: ["appointments", "unknown", "reports"],
        actorUserId,
      })
    ).resolves.toEqual({ ok: true, value: ["appointments", "reports"] });

    expect(mockedSetSalonDisabledFeatures).toHaveBeenCalledWith("salon-1", [
      "appointments",
      "reports",
    ]);
    expect(mockedRecordPlatformAction).toHaveBeenCalledWith({
      actorUserId,
      action: "update_salon_features",
      status: "succeeded",
      targetSalonId: "salon-1",
      metadata: { disabledFeatures: ["appointments", "reports"] },
    });
  });

  it("records failed feature changes with a stable platform error", async () => {
    mockedSetSalonDisabledFeatures.mockRejectedValue(new Error("database down"));

    const result = await updateSalonFeatures({
      salonId: "salon-1",
      disabledFeatures: ["appointments"],
      actorUserId,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("database down");
    expect(mockedRecordPlatformAction).toHaveBeenCalledWith({
      actorUserId,
      action: "update_salon_features",
      status: "failed",
      targetSalonId: "salon-1",
      metadata: { disabledFeatures: ["appointments"] },
      errorMessage: "database down",
    });
  });
});
