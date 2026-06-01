import { beforeEach, describe, expect, it, vi } from "vitest";
import { findOccupiedSlotsForSalonDate } from "../data/appointment-commands.repo";
import { getOccupiedSlotsForSalonDate } from "./appointment-availability";

vi.mock("../data/appointment-commands.repo", () => ({
  findOccupiedSlotsForSalonDate: vi.fn(),
}));

const mockedFindOccupiedSlotsForSalonDate = vi.mocked(findOccupiedSlotsForSalonDate);

describe("appointment availability command read", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindOccupiedSlotsForSalonDate.mockResolvedValue({});
  });

  it("delegates salon-date availability to the command adapter", async () => {
    mockedFindOccupiedSlotsForSalonDate.mockResolvedValue({
      "employee-1": [
        {
          start_time: "2030-01-01T10:00:00.000Z",
          end_time: "2030-01-01T10:30:00.000Z",
        },
      ],
    });

    await expect(
      getOccupiedSlotsForSalonDate("salon-1", "2030-01-01")
    ).resolves.toEqual({
      "employee-1": [
        {
          start_time: "2030-01-01T10:00:00.000Z",
          end_time: "2030-01-01T10:30:00.000Z",
        },
      ],
    });
    expect(mockedFindOccupiedSlotsForSalonDate).toHaveBeenCalledWith(
      "salon-1",
      "2030-01-01",
      undefined
    );
  });
});
