import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordAuditLogEntry } from "./data/audit-log.repo";
import { captureError } from "@/infra/observability";
import { publishAuditEvent } from "./publish-audit-event";

// La accion del super-admin se emite como evento post-commit. El manejador
// escribe la auditoria; si falla, el caso de uso recibe un aviso y nunca se
// rechaza la accion ya confirmada.

vi.mock("./data/audit-log.repo", () => ({
  recordAuditLogEntry: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedRecordEntry = vi.mocked(recordAuditLogEntry);
const mockedCaptureError = vi.mocked(captureError);

const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
const SALON_ID = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.resetAllMocks();
  mockedRecordEntry.mockResolvedValue(undefined);
});

describe("publishAuditEvent", () => {
  it("skips the event entirely when there is no acting admin", async () => {
    const warnings = await publishAuditEvent("platform.salon_status_changed", {
      actorUserId: null,
      action: "set_salon_status",
      status: "succeeded",
    });

    expect(warnings).toEqual([]);
    expect(mockedRecordEntry).not.toHaveBeenCalled();
  });

  it("treats an empty actor id as no actor", async () => {
    await publishAuditEvent("platform.salon_status_changed", {
      actorUserId: "",
      action: "set_salon_status",
      status: "succeeded",
    });

    expect(mockedRecordEntry).not.toHaveBeenCalled();
  });

  it("hands the manejador the full audit payload with normalized targets", async () => {
    await publishAuditEvent("platform.salon_status_changed", {
      actorUserId: ACTOR_ID,
      action: "set_salon_status",
      status: "succeeded",
      targetSalonId: SALON_ID,
      metadata: { isActive: false },
    });

    expect(mockedRecordEntry).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: "set_salon_status",
      status: "succeeded",
      targetSalonId: SALON_ID,
      targetResourceType: null,
      targetResourceId: null,
      metadata: { isActive: false },
      errorMessage: null,
    });
  });

  it("returns a warning and reports the failure when the audit write fails", async () => {
    const adapterError = new Error("insert denied");
    mockedRecordEntry.mockRejectedValue(adapterError);

    const warnings = await publishAuditEvent("platform.salon_deleted", {
      actorUserId: ACTOR_ID,
      action: "delete_salon",
      status: "failed",
      targetSalonId: SALON_ID,
      targetResourceId: "res-1",
    });

    expect(warnings).toEqual(["No se completó el paso «platform.salon_deleted»."]);
    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "record_audit",
      metadata: {
        effect: "platform.salon_deleted",
        auditAction: "delete_salon",
        auditStatus: "failed",
        targetSalonId: SALON_ID,
        targetResourceId: "res-1",
      },
    });
  });

  it("returns no warnings when the audit write succeeds", async () => {
    const warnings = await publishAuditEvent("platform.salon_invited", {
      actorUserId: ACTOR_ID,
      action: "invite_salon",
      status: "succeeded",
    });

    expect(warnings).toEqual([]);
    expect(mockedCaptureError).not.toHaveBeenCalled();
  });
});
