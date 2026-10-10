import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import {
  updateSalonStatus as updateSalonStatusWithDeps,
  type UpdateSalonStatusDeps,
  type UpdateSalonStatusInput,
} from "./update-salon-status";
import { PublicError } from "@/infra/public-error";

// Suspender o reactivar un salón: el id llega con espacios del formulario y
// se normaliza antes de tocar la base; cada cambio queda auditado con el
// estado solicitado.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

// Fakes tipados de las dependencias: ningún test toca Supabase ni auditoría real.
const deps: UpdateSalonStatusDeps = {
  setSalonActiveStatus: vi.fn<UpdateSalonStatusDeps["setSalonActiveStatus"]>(),
  publishAuditEvent: vi.fn<UpdateSalonStatusDeps["publishAuditEvent"]>(async () => []),
};

const updateSalonStatus = (input: UpdateSalonStatusInput) => updateSalonStatusWithDeps(input, deps);

const mockedSetStatus = vi.mocked(deps.setSalonActiveStatus);
const mockedAudit = vi.mocked(deps.publishAuditEvent);
const mockedCaptureError = vi.mocked(captureError);

const SALON_ID = "00000000-0000-4000-8000-000000000002";
const ACTOR_ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
  mockedSetStatus.mockResolvedValue(undefined);
  mockedAudit.mockResolvedValue([]);
});

describe("updateSalonStatus input handling", () => {
  it("trims the salón id before it reaches the adapter and the audit trail", async () => {
    await updateSalonStatus({ salonId: `  ${SALON_ID}\n`, isActive: false, actorUserId: ACTOR_ID });

    expect(mockedSetStatus).toHaveBeenCalledWith(SALON_ID, false);
    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_status_changed", expect.objectContaining({ targetSalonId: SALON_ID }));
  });

  it("rejects a whitespace-only id without calling the adapter or auditing", async () => {
    const result = await updateSalonStatus({ salonId: "   ", isActive: true, actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: false, error: "Salón inválido." });
    expect(mockedSetStatus).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("returns the requested status as the value on success", async () => {
    const suspend = await updateSalonStatus({ salonId: SALON_ID, isActive: false });
    const reactivate = await updateSalonStatus({ salonId: SALON_ID, isActive: true });

    expect(suspend).toEqual({ ok: true, value: false });
    expect(reactivate).toEqual({ ok: true, value: true });
  });

  it("audits with a null actor when none was supplied", async () => {
    await updateSalonStatus({ salonId: SALON_ID, isActive: true });

    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_status_changed", {
      actorUserId: null,
      action: "set_salon_status",
      status: "succeeded",
      targetSalonId: SALON_ID,
      metadata: { isActive: true },
    });
  });
});

describe("updateSalonStatus failures", () => {
  it("hides the adapter detail from the public message, logs it and audits the failed attempt", async () => {
    const adapterError = new Error("relation salons violates constraint");
    mockedSetStatus.mockRejectedValue(adapterError);

    const result = await updateSalonStatus({ salonId: SALON_ID, isActive: false, actorUserId: ACTOR_ID });

    expect(result).toEqual({
      ok: false,
      error: "No se pudo actualizar el estado del salón.",
    });
    expect(JSON.stringify(result)).not.toContain("constraint");
    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "set_salon_status",
      metadata: { salonId: SALON_ID, isActive: false },
    });
    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_status_changed", {
      actorUserId: ACTOR_ID,
      action: "set_salon_status",
      status: "failed",
      targetSalonId: SALON_ID,
      metadata: { isActive: false },
      errorMessage: "relation salons violates constraint",
    });
  });

  it("uses the fixed message when the adapter rejects with a non-Error value", async () => {
    mockedSetStatus.mockRejectedValue({ code: 500 });

    const result = await updateSalonStatus({ salonId: SALON_ID, isActive: true });

    expect(result).toEqual({
      ok: false,
      error: "No se pudo actualizar el estado del salón.",
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      "platform.salon_status_changed", expect.objectContaining({ status: "failed", errorMessage: "Error desconocido" })
    );
  });

  it("shows the message of a PublicError thrown on purpose by the adapter", async () => {
    mockedSetStatus.mockRejectedValue(new PublicError("Salón no encontrado."));

    const result = await updateSalonStatus({ salonId: SALON_ID, isActive: false });

    expect(result).toEqual({ ok: false, error: "Salón no encontrado." });
    expect(mockedCaptureError).toHaveBeenCalled();
  });
});
