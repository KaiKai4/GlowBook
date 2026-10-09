import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSalonCompletely } from "../data/delete-salon.repo";
import { deleteSalon } from "./delete-salon";
import { recordPlatformAction } from "./platform-audit";

vi.mock("../data/delete-salon.repo", () => ({
  deleteSalonCompletely: vi.fn(),
}));

vi.mock("./platform-audit", () => ({
  recordPlatformAction: vi.fn(async () => []),
}));

const mockedDeleteSalonCompletely = vi.mocked(deleteSalonCompletely);
const mockedRecordPlatformAction = vi.mocked(recordPlatformAction);
const actorUserId = "00000000-0000-4000-8000-000000000001";

describe("delete salon", () => {
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
      error: "Para eliminar el salon debes escribir exactamente su ID.",
    });
    expect(mockedDeleteSalonCompletely).not.toHaveBeenCalled();
  });

  it("deletes the salon when confirmation matches", async () => {
    await expect(
      deleteSalon({ salonId: "salon-1", confirmation: "salon-1", actorUserId })
    ).resolves.toEqual({ ok: true, value: undefined });
    expect(mockedDeleteSalonCompletely).toHaveBeenCalledWith("salon-1");
    expect(mockedRecordPlatformAction).toHaveBeenCalledWith({
      actorUserId,
      action: "delete_salon",
      status: "succeeded",
      targetSalonId: "salon-1",
    });
  });

  it("returns Adapter failure details for platform operators", async () => {
    mockedDeleteSalonCompletely.mockRejectedValue(new Error("Auth cleanup failed"));

    const result = await deleteSalon({
      salonId: "salon-1",
      confirmation: "salon-1",
      actorUserId,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Auth cleanup failed");
    expect(mockedRecordPlatformAction).toHaveBeenCalledWith({
      actorUserId,
      action: "delete_salon",
      status: "failed",
      targetSalonId: "salon-1",
      errorMessage: "Auth cleanup failed",
    });
  });
});
