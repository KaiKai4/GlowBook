import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordPlatformAudit } from "@/features/platform/data/platform-audit.repo";
import { AUDIT_EVENT_HANDLERS } from "./audit-event-handlers";
import { AUDIT_EVENT_BY_ACTION, type AuditEventName, type AuditEventPayload } from "./audit-events";
import { auditActionOptions } from "./audit-messages";

vi.mock("@/features/platform/data/platform-audit.repo", () => ({
  recordPlatformAudit: vi.fn(),
}));

const mockedRecordAudit = vi.mocked(recordPlatformAudit);

// Catalogo completo de eventos de auditoria. Si el tipo AuditEventName gana o
// pierde un evento, este test debe cambiar a la vez.
const ALL_EVENT_NAMES: AuditEventName[] = [
  "platform.salon_invited",
  "platform.salon_invitation_regenerated",
  "platform.salon_status_changed",
  "platform.salon_features_updated",
  "platform.salon_deleted",
  "platform.feedback_status_changed",
  "salon.invitation_accepted",
  "billing.feature_saved",
  "billing.plan_created",
  "billing.entitlement_saved",
  "billing.legacy_plan_assigned",
  "billing.legacy_override_saved",
  "billing.module_saved",
  "billing.plan_saved",
  "billing.plan_archived",
  "billing.plan_deleted",
  "billing.plan_module_saved",
  "billing.limit_metric_saved",
  "billing.plan_limit_saved",
  "billing.plan_assigned",
  "billing.plan_override_saved",
  "billing.addon_saved",
  "billing.addon_archived",
  "billing.addon_deleted",
  "billing.plan_extra_assigned",
  "billing.plan_extra_canceled",
  "billing.payment_registered",
  "billing.plan_alert_resolved",
];

describe("catalogo de eventos de auditoria", () => {
  it("cada accion emite exactamente un evento del catalogo y no queda evento huerfano", () => {
    const emitted = Object.values(AUDIT_EVENT_BY_ACTION);

    expect(new Set(emitted).size).toBe(emitted.length);
    expect([...emitted].sort()).toEqual([...ALL_EVENT_NAMES].sort());
  });

  it("todas las acciones tienen su texto de presentacion", () => {
    expect(auditActionOptions().map((option) => option.value).sort()).toEqual(Object.keys(AUDIT_EVENT_BY_ACTION).sort());
  });

  it("cada evento del catalogo tiene un manejador registrado", () => {
    expect(Object.keys(AUDIT_EVENT_HANDLERS).sort()).toEqual([...ALL_EVENT_NAMES].sort());
  });
});

describe("manejador de auditoria", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedRecordAudit.mockResolvedValue(undefined);
  });

  it("persiste el payload del evento en platform_audit_log", async () => {
    const payload: AuditEventPayload = {
      actorUserId: "admin-1",
      action: "commercial_plan_payment_recorded",
      status: "succeeded",
      targetSalonId: "salon-1",
      targetResourceType: "commercial_plan",
      targetResourceId: null,
      metadata: { amount: 10 },
      errorMessage: null,
    };

    await AUDIT_EVENT_HANDLERS["billing.payment_registered"](payload);

    expect(mockedRecordAudit).toHaveBeenCalledWith({
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

  it("propaga el fallo de escritura para que el bus lo convierta en aviso", async () => {
    mockedRecordAudit.mockRejectedValue(new Error("db caida"));

    await expect(
      AUDIT_EVENT_HANDLERS["platform.salon_deleted"]({
        actorUserId: "admin-1",
        action: "delete_salon",
        status: "failed",
        targetSalonId: null,
        targetResourceType: null,
        targetResourceId: null,
        metadata: {},
        errorMessage: "x",
      })
    ).rejects.toThrow("db caida");
  });
});
