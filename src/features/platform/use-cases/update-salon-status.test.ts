import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  updateSalonStatus as updateSalonStatusWithDeps,
  type UpdateSalonStatusDeps,
  type UpdateSalonStatusInput,
} from "./update-salon-status";

// Fakes tipados de las dependencias: ningún test toca Supabase ni auditoría real.
const deps: UpdateSalonStatusDeps = {
  setSalonActiveStatus: vi.fn<UpdateSalonStatusDeps["setSalonActiveStatus"]>(),
  publishAuditEvent: vi.fn<UpdateSalonStatusDeps["publishAuditEvent"]>(async () => []),
};

const updateSalonStatus = (input: UpdateSalonStatusInput) => updateSalonStatusWithDeps(input, deps);

const mockedSetSalonActiveStatus = vi.mocked(deps.setSalonActiveStatus);
const mockedPublishAuditEvent = vi.mocked(deps.publishAuditEvent);
const actorUserId = "00000000-0000-4000-8000-000000000001";

describe("update salón status", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedSetSalonActiveStatus.mockResolvedValue(undefined);
  });

  it("suspends or reactivates a salón and records the platform action", async () => {
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

  it("rejects blank Salón ids before touching the data Adapter", async () => {
    const result = await updateSalonStatus({
      salonId: "   ",
      isActive: true,
      actorUserId,
    });

    expect(result).toEqual({ ok: false, error: "Salón inválido." });
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
