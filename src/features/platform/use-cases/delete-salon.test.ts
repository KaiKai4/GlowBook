import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteSalon as deleteSalonWithDeps,
  type DeleteSalonDeps,
  type DeleteSalonInput,
} from "./delete-salon";

// Fakes tipados de las dependencias: ningún test toca Supabase ni auditoría real.
const deps: DeleteSalonDeps = {
  deleteSalonCompletely: vi.fn<DeleteSalonDeps["deleteSalonCompletely"]>(),
  publishAuditEvent: vi.fn<DeleteSalonDeps["publishAuditEvent"]>(async () => []),
};

const deleteSalon = (input: DeleteSalonInput) => deleteSalonWithDeps(input, deps);

const mockedDeleteSalonCompletely = vi.mocked(deps.deleteSalonCompletely);
const mockedPublishAuditEvent = vi.mocked(deps.publishAuditEvent);
const actorUserId = "00000000-0000-4000-8000-000000000001";

describe("delete salón", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedDeleteSalonCompletely.mockResolvedValue(undefined);
  });

  it("requires exact id confirmation before running the destructive adapter", async () => {
    const result = await deleteSalon({
      salonId: "salon-1",
      confirmation: "wrong",
    });

    expect(result).toEqual({
      ok: false,
      error: "Para eliminar el salón debes escribir exactamente su ID.",
    });
    expect(mockedDeleteSalonCompletely).not.toHaveBeenCalled();
  });

  it("deletes the salón when confirmation matches", async () => {
    await expect(
      deleteSalon({ salonId: "salon-1", confirmation: "salon-1", actorUserId })
    ).resolves.toEqual({ ok: true, value: undefined });
    expect(mockedDeleteSalonCompletely).toHaveBeenCalledWith("salon-1");
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("platform.salon_deleted", {
      actorUserId,
      action: "delete_salon",
      status: "succeeded",
      targetSalonId: "salon-1",
    });
  });

  it("keeps adapter failure details out of the public message and audits them", async () => {
    mockedDeleteSalonCompletely.mockRejectedValue(new Error("Auth cleanup failed"));

    const result = await deleteSalon({
      salonId: "salon-1",
      confirmation: "salon-1",
      actorUserId,
    });

    expect(result).toEqual({ ok: false, error: "No se pudo eliminar el salón y sus datos." });
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("platform.salon_deleted", {
      actorUserId,
      action: "delete_salon",
      status: "failed",
      targetSalonId: "salon-1",
      errorMessage: "Auth cleanup failed",
    });
  });
});
