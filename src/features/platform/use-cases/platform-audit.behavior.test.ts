import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordPlatformAudit } from "@/features/platform/data/platform-audit.repo";
import { captureError } from "@/lib/observability";
import { recordPlatformAction } from "./platform-audit";

// Auditoria best-effort: sin actor no hay nada que registrar, y un fallo al
// escribir la auditoria nunca debe tumbar la accion del super-admin, pero si
// queda registrado en observabilidad.

vi.mock("@/features/platform/data/platform-audit.repo", () => ({
  recordPlatformAudit: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

const mockedRecordAudit = vi.mocked(recordPlatformAudit);
const mockedCaptureError = vi.mocked(captureError);

const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
const SALON_ID = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.resetAllMocks();
  mockedRecordAudit.mockResolvedValue(undefined);
});

describe("recordPlatformAction", () => {
  it("skips the write entirely when there is no acting admin", async () => {
    await recordPlatformAction({ actorUserId: null, action: "set_salon_status", status: "succeeded" });

    expect(mockedRecordAudit).not.toHaveBeenCalled();
  });

  it("treats an empty actor id as no actor", async () => {
    await recordPlatformAction({ actorUserId: "", action: "set_salon_status", status: "succeeded" });

    expect(mockedRecordAudit).not.toHaveBeenCalled();
  });

  it("forwards the full audit input when an admin acted", async () => {
    const input = {
      actorUserId: ACTOR_ID,
      action: "set_salon_status" as const,
      status: "succeeded" as const,
      targetSalonId: SALON_ID,
      metadata: { isActive: false },
    };

    await recordPlatformAction(input);

    expect(mockedRecordAudit).toHaveBeenCalledWith(input);
  });

  it("swallows adapter failures and reports them with the audit context", async () => {
    const adapterError = new Error("insert denied");
    mockedRecordAudit.mockRejectedValue(adapterError);

    await expect(
      recordPlatformAction({
        actorUserId: ACTOR_ID,
        action: "delete_salon",
        status: "failed",
        targetSalonId: SALON_ID,
        targetResourceId: "res-1",
      })
    ).resolves.toBeUndefined();

    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "record_audit",
      metadata: {
        auditAction: "delete_salon",
        auditStatus: "failed",
        targetSalonId: SALON_ID,
        targetResourceId: "res-1",
      },
    });
  });
});
