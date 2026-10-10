import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordAuditLogEntry } from "./data/audit-log.repo";
import { recordAuditEvent } from "./audit-event-writer";
import type { AuditEventPayload } from "./events";

vi.mock("./data/audit-log.repo", () => ({
  recordAuditLogEntry: vi.fn(),
}));

const mockedRecordEntry = vi.mocked(recordAuditLogEntry);

describe("recordAuditEvent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedRecordEntry.mockResolvedValue(undefined);
  });

  it("persiste el payload completo del evento en platform_audit_log", async () => {
    const payload: AuditEventPayload<"commercial_plan_payment_recorded"> = {
      actorUserId: "admin-1",
      action: "commercial_plan_payment_recorded",
      status: "succeeded",
      targetSalonId: "salon-1",
      targetResourceType: "commercial_plan",
      targetResourceId: null,
      metadata: { amount: 10 },
      errorMessage: null,
    };

    await recordAuditEvent(payload);

    expect(mockedRecordEntry).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      action: "commercial_plan_payment_recorded",
      status: "succeeded",
      targetSalonId: "salon-1",
      targetResourceType: "commercial_plan",
      targetResourceId: null,
      metadata: { amount: 10 },
      errorMessage: null,
    });
  });

  it("normaliza los opcionales ausentes a null y {} antes de escribir", async () => {
    await recordAuditEvent({ actorUserId: null, action: "delete_salon", status: "failed" });

    expect(mockedRecordEntry).toHaveBeenCalledWith({
      actorUserId: null,
      action: "delete_salon",
      status: "failed",
      targetSalonId: null,
      targetResourceType: null,
      targetResourceId: null,
      metadata: {},
      errorMessage: null,
    });
  });

  it("propaga el fallo de escritura para que quien llama lo convierta en aviso", async () => {
    mockedRecordEntry.mockRejectedValue(new Error("db caida"));

    await expect(
      recordAuditEvent({ actorUserId: "admin-1", action: "delete_salon", status: "failed" })
    ).rejects.toThrow("db caida");
  });
});
