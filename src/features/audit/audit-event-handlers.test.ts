import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordAuditLogEntry } from "./data/audit-log.repo";
import { AUDIT_EVENT_HANDLERS } from "./audit-event-handlers";
import { PLATFORM_AUDIT_ACTIONS } from "./domain/audit-actions";
import type { AuditEventName, AuditEventPayload } from "./events";

vi.mock("./data/audit-log.repo", () => ({
  recordAuditLogEntry: vi.fn(),
}));

const mockedRecordEntry = vi.mocked(recordAuditLogEntry);

// Catalogo completo de eventos de auditoria. Si AuditEventName gana o pierde un
// evento, este test debe cambiar a la vez.
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

describe("catalogo de manejadores de auditoria", () => {
  it("cada evento del catalogo tiene exactamente un manejador registrado", () => {
    expect(Object.keys(AUDIT_EVENT_HANDLERS).sort()).toEqual([...ALL_EVENT_NAMES].sort());
  });
});

describe("manejador de auditoria", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedRecordEntry.mockResolvedValue(undefined);
  });

  it("persiste el payload del evento en platform_audit_log", async () => {
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

    await AUDIT_EVENT_HANDLERS["billing.payment_registered"](payload);

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
    await AUDIT_EVENT_HANDLERS["platform.salon_deleted"]({
      actorUserId: null,
      action: "delete_salon",
      status: "failed",
    });

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

  it("propaga el fallo de escritura para que el bus lo convierta en aviso", async () => {
    mockedRecordEntry.mockRejectedValue(new Error("db caida"));

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

describe("mapa evento -> accion de auditoria", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedRecordEntry.mockResolvedValue(undefined);
  });

  it("cubre exactamente los eventos del catalogo", () => {
    expect(Object.keys(AUDIT_EVENT_HANDLERS).sort()).toEqual([...ALL_EVENT_NAMES].sort());
  });

  it("el manejador generico registra cada evento con la accion que recibe", async () => {
    for (const name of ALL_EVENT_NAMES) {
      // El manejador es generico: se tipa con el payload general y se le pasa
      // una accion del catalogo cerrado.
      const action = PLATFORM_AUDIT_ACTIONS[0];
      const handler = AUDIT_EVENT_HANDLERS[name] as (payload: AuditEventPayload) => Promise<void>;
      await handler({ actorUserId: "admin-1", action, status: "succeeded" });
      expect(mockedRecordEntry).toHaveBeenLastCalledWith(expect.objectContaining({ action }));
    }
    expect(mockedRecordEntry).toHaveBeenCalledTimes(ALL_EVENT_NAMES.length);
  });
});
