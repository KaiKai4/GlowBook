import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSalonActiveStatus } from "@/features/platform/data/salons.repo";
import { updateSalonStatus } from "./update-salon-status";
import { publishAuditEvent } from "@/features/audit";

vi.mock("@/features/platform/data/salons.repo", () => ({
  setSalonActiveStatus: vi.fn(),
}));

vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const mockedSetSalonActiveStatus = vi.mocked(setSalonActiveStatus);
const mockedPublishAuditEvent = vi.mocked(publishAuditEvent);
const actorUserId = "00000000-0000-4000-8000-000000000001";

describe("update salon status", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedSetSalonActiveStatus.mockResolvedValue(undefined);
  });

  it("suspends or reactivates a salon and records the platform action", async () => {
    await expect(
      updateSalonStatus({
        salonId: "salon-1",
        isActive: false,
        actorUserId,
      })
    ).resolves.toEqual({ ok: true, value: false });

    expect(mockedSetSalonActiveStatus).toHaveBeenCalledWith("salon-1", false);
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("platform.salon_status_changed", {
      actorUserId,
      action: "set_salon_status",
      status: "succeeded",
      targetSalonId: "salon-1",
      metadata: { isActive: false },
    });
  });

  it("rejects blank Salon ids before touching the data Adapter", async () => {
    const result = await updateSalonStatus({
      salonId: "   ",
      isActive: true,
      actorUserId,
    });

    expect(result).toEqual({ ok: false, error: "Salon inválido." });
    expect(mockedSetSalonActiveStatus).not.toHaveBeenCalled();
    expect(mockedPublishAuditEvent).not.toHaveBeenCalled();
  });

  it("records failed status changes with a stable platform error", async () => {
    mockedSetSalonActiveStatus.mockRejectedValue(new Error("database down"));

    const result = await updateSalonStatus({
      salonId: "salon-1",
      isActive: true,
      actorUserId,
    });

    expect(result).toEqual({ ok: false, error: "No se pudo actualizar el estado del salón." });
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("platform.salon_status_changed", {
      actorUserId,
      action: "set_salon_status",
      status: "failed",
      targetSalonId: "salon-1",
      metadata: { isActive: true },
      errorMessage: "database down",
    });
  });
});
