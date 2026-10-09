import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSalonCompletely } from "@/features/platform/data/delete-salon.repo";
import { captureError } from "@/infra/observability";
import { deleteSalon } from "./delete-salon";
import { recordPlatformAction } from "./platform-audit";

// Borrado destructivo: la confirmacion debe coincidir exactamente con el id
// del salon y, aunque se rechace, el intento queda auditado. Solo un borrado
// completado devuelve ok.

vi.mock("@/features/platform/data/delete-salon.repo", () => ({
  deleteSalonCompletely: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("./platform-audit", () => ({
  recordPlatformAction: vi.fn(async () => []),
}));

const mockedDeleteCompletely = vi.mocked(deleteSalonCompletely);
const mockedAudit = vi.mocked(recordPlatformAction);
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
      error: "Para eliminar el salon debes escribir exactamente su ID.",
    });
    expect(mockedDeleteCompletely).not.toHaveBeenCalled();
  });

  it("audits the rejected confirmation as a failed delete for that salon", async () => {
    await deleteSalon({ salonId: SALON_ID, confirmation: "otro-id", actorUserId: ACTOR_ID });

    expect(mockedAudit).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: "delete_salon",
      status: "failed",
      targetSalonId: SALON_ID,
      errorMessage: "Confirmation mismatch.",
    });
  });

  it("audits a mismatched confirmation with a null actor when none is supplied", async () => {
    await deleteSalon({ salonId: SALON_ID, confirmation: "" });

    expect(mockedAudit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: null }));
    expect(mockedDeleteCompletely).not.toHaveBeenCalled();
  });
});

describe("deleteSalon execution", () => {
  it("deletes the salon when the exact id was confirmed and audits the success", async () => {
    const result = await deleteSalon({ salonId: SALON_ID, confirmation: SALON_ID, actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedDeleteCompletely).toHaveBeenCalledWith(SALON_ID);
    expect(mockedAudit).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: "delete_salon",
      status: "succeeded",
      targetSalonId: SALON_ID,
    });
  });

  it("returns the adapter detail, logs it and audits the failure when the deletion fails", async () => {
    const adapterError = new Error("Auth cleanup failed");
    mockedDeleteCompletely.mockRejectedValue(adapterError);

    const result = await deleteSalon({ salonId: SALON_ID, confirmation: SALON_ID, actorUserId: ACTOR_ID });

    expect(result).toEqual({
      ok: false,
      error: "No se pudo eliminar el salon y sus datos. Detalle: Auth cleanup failed",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "delete_salon",
      metadata: { salonId: SALON_ID },
    });
    expect(mockedAudit).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: "delete_salon",
      status: "failed",
      targetSalonId: SALON_ID,
      errorMessage: "Auth cleanup failed",
    });
  });

  it("uses a generic detail when the deletion rejects with a non-Error value", async () => {
    mockedDeleteCompletely.mockRejectedValue(null);

    const result = await deleteSalon({ salonId: SALON_ID, confirmation: SALON_ID });

    expect(result).toEqual({
      ok: false,
      error: "No se pudo eliminar el salon y sus datos. Detalle: Error desconocido",
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "Error desconocido" })
    );
  });
});
