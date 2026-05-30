import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSalonCompletely } from "../data/delete-salon.repo";
import { deleteSalon } from "./delete-salon";

vi.mock("../data/delete-salon.repo", () => ({
  deleteSalonCompletely: vi.fn(),
}));

const mockedDeleteSalonCompletely = vi.mocked(deleteSalonCompletely);

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
      deleteSalon({ salonId: "salon-1", confirmation: "salon-1" })
    ).resolves.toEqual({ ok: true, value: undefined });
    expect(mockedDeleteSalonCompletely).toHaveBeenCalledWith("salon-1");
  });

  it("returns Adapter failure details for platform operators", async () => {
    mockedDeleteSalonCompletely.mockRejectedValue(new Error("Auth cleanup failed"));

    const result = await deleteSalon({
      salonId: "salon-1",
      confirmation: "salon-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Auth cleanup failed");
  });
});
