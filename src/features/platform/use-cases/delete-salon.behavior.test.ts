import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import {
  deleteSalon as deleteSalonWithDeps,
  type DeleteSalonDeps,
  type DeleteSalonInput,
} from "./delete-salon";
import { PublicError } from "@/infra/public-error";

// Borrado destructivo: la confirmacion debe coincidir exactamente con el id
// del salón y, aunque se rechace, el intento queda auditado. Solo un borrado
// completado devuelve ok.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

// Fakes tipados de las dependencias: ningún test toca Supabase ni auditoría real.
const deps: DeleteSalonDeps = {
  deleteSalonCompletely: vi.fn<DeleteSalonDeps["deleteSalonCompletely"]>(),
  publishAuditEvent: vi.fn<DeleteSalonDeps["publishAuditEvent"]>(async () => []),
};

const deleteSalon = (input: DeleteSalonInput) => deleteSalonWithDeps(input, deps);

const mockedDeleteCompletely = vi.mocked(deps.deleteSalonCompletely);
const mockedAudit = vi.mocked(deps.publishAuditEvent);
const mockedCaptureError = vi.mocked(captureError);

const SALON_ID = "00000000-0000-4000-8000-000000000002";
const ACTOR_ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
  mockedDeleteCompletely.mockResolvedValue(undefined);
  mockedAudit.mockResolvedValue([]);
});

describe("deleteSalon confirmation", () => {
  it("rejects a confirmation that differs only by surrounding spaces, without deleting", async () => {
    const result = await deleteSalon({ salonId: SALON_ID, confirmation: ` ${SALON_ID}`, actorUserId: ACTOR_ID });

    expect(result).toEqual({
      ok: false,
      error: "Para eliminar el salón debes escribir exactamente su ID.",
    });
    expect(mockedDeleteCompletely).not.toHaveBeenCalled();
  });

  it("audits the rejected confirmation as a failed delete for that salón", async () => {
    await deleteSalon({ salonId: SALON_ID, confirmation: "otro-id", actorUserId: ACTOR_ID });

    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_deleted", {
      actorUserId: ACTOR_ID,
      action: "delete_salon",
      status: "failed",
      targetSalonId: SALON_ID,
      errorMessage: "Confirmation mismatch.",
    });
  });

  it("audits a mismatched confirmation with a null actor when none is supplied", async () => {
    await deleteSalon({ salonId: SALON_ID, confirmation: "" });

    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_deleted", expect.objectContaining({ actorUserId: null }));
    expect(mockedDeleteCompletely).not.toHaveBeenCalled();
  });
});

describe("deleteSalon execution", () => {
  it("deletes the salón when the exact id was confirmed and audits the success", async () => {
    const result = await deleteSalon({ salonId: SALON_ID, confirmation: SALON_ID, actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedDeleteCompletely).toHaveBeenCalledWith(SALON_ID);
    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_deleted", {
      actorUserId: ACTOR_ID,
      action: "delete_salon",
      status: "succeeded",
      targetSalonId: SALON_ID,
    });
  });

  it("hides the adapter detail from the public message, logs it and audits the failure", async () => {
    const adapterError = new Error("Auth cleanup failed");
    mockedDeleteCompletely.mockRejectedValue(adapterError);

    const result = await deleteSalon({ salonId: SALON_ID, confirmation: SALON_ID, actorUserId: ACTOR_ID });

    expect(result).toEqual({
      ok: false,
      error: "No se pudo eliminar el salón y sus datos.",
    });
    expect(JSON.stringify(result)).not.toContain("Auth cleanup failed");
    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "delete_salon",
      metadata: { salonId: SALON_ID },
    });
    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_deleted", {
      actorUserId: ACTOR_ID,
      action: "delete_salon",
      status: "failed",
      targetSalonId: SALON_ID,
      errorMessage: "Auth cleanup failed",
    });
  });

  it("uses the fixed message when the deletion rejects with a non-Error value", async () => {
    mockedDeleteCompletely.mockRejectedValue(null);

    const result = await deleteSalon({ salonId: SALON_ID, confirmation: SALON_ID });

    expect(result).toEqual({
      ok: false,
      error: "No se pudo eliminar el salón y sus datos.",
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      "platform.salon_deleted", expect.objectContaining({ status: "failed", errorMessage: "Error desconocido" })
    );
  });

  it("shows the message of a PublicError thrown on purpose by the adapter", async () => {
    mockedDeleteCompletely.mockRejectedValue(new PublicError("El salón tiene facturas abiertas."));

    const result = await deleteSalon({ salonId: SALON_ID, confirmation: SALON_ID, actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: false, error: "El salón tiene facturas abiertas." });
    expect(mockedCaptureError).toHaveBeenCalled();
  });
});
