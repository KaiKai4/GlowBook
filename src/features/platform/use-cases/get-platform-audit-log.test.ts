import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPlatformAuditLog } from "../data/platform-audit.repo";
import { getPlatformAuditLog } from "./get-platform-audit-log";

vi.mock("../data/platform-audit.repo", () => ({
  findPlatformAuditLog: vi.fn(),
}));

const mockedFindPlatformAuditLog = vi.mocked(findPlatformAuditLog);

describe("get platform audit log", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindPlatformAuditLog.mockResolvedValue([]);
  });

  it("maps audit rows into a compact Platform view model", async () => {
    mockedFindPlatformAuditLog.mockResolvedValue([
      {
        id: "audit-1",
        actor_user_id: "00000000-0000-4000-8000-000000000001",
        action: "delete_salon",
        status: "failed",
        target_salon_id: "11111111-1111-4111-8111-111111111111",
        target_resource_type: null,
        target_resource_id: null,
        metadata: { disabledFeatures: ["appointments", "reports"], empty: "" },
        error_message: "Auth cleanup failed",
        created_at: "2026-05-30T15:30:00.000Z",
      },
    ]);

    const view = await getPlatformAuditLog();

    expect(view.totalVisible).toBe(1);
    expect(view.failedCount).toBe(1);
    expect(view.entries[0]).toMatchObject({
      id: "audit-1",
      actionLabel: "Eliminar Salon",
      statusLabel: "Fallida",
      actorLabel: "Admin 00000000",
      targetLabel: "Salon 11111111",
      errorMessage: "Auth cleanup failed",
      metadata: [{ key: "disabledFeatures", value: "appointments, reports" }],
    });
  });

  it("passes only supported filters to the data Adapter", async () => {
    await getPlatformAuditLog({ action: "invite_salon", status: "failed" });

    expect(mockedFindPlatformAuditLog).toHaveBeenCalledWith({
      action: "invite_salon",
      status: "failed",
      limit: 100,
    });
  });

  it("ignores unknown filters instead of leaking query details to app callers", async () => {
    await getPlatformAuditLog({ action: "unknown", status: "weird" });

    expect(mockedFindPlatformAuditLog).toHaveBeenCalledWith({
      action: undefined,
      status: undefined,
      limit: 100,
    });
  });
});
