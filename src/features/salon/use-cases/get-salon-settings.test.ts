import { beforeEach, describe, expect, it, vi } from "vitest";
import { findBusinessHours, findSalonSettings } from "../data/salon.repo";
import { getSalonSettings } from "./get-salon-settings";

vi.mock("../data/salon.repo", () => ({
  findBusinessHours: vi.fn(),
  findSalonSettings: vi.fn(),
}));

const mockedFindBusinessHours = vi.mocked(findBusinessHours);
const mockedFindSalonSettings = vi.mocked(findSalonSettings);

describe("get salon settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("normalizes all weekdays and trims time values for time inputs", async () => {
    mockedFindSalonSettings.mockResolvedValue({
      id: "salon-1",
      name: "Glow Studio",
      timezone: "America/Panama",
      theme: "rosewater",
      bg_style: "colored",
    });
    mockedFindBusinessHours.mockResolvedValue([
      { day_of_week: 0, is_open: true, open_time: "08:30:00", close_time: "17:15:00" },
      { day_of_week: 6, is_open: false, open_time: null, close_time: null },
    ]);

    const result = await getSalonSettings("salon-1");

    expect(result).toMatchObject({
      salonName: "Glow Studio",
      timezone: "America/Panama",
      theme: "rosewater",
      bgStyle: "colored",
    });
    expect(result.businessHours).toHaveLength(7);
    expect(result.businessHours[0]).toEqual({
      day_of_week: 0,
      is_open: true,
      open_time: "08:30",
      close_time: "17:15",
    });
    expect(result.businessHours[1]).toEqual({
      day_of_week: 1,
      is_open: false,
      open_time: "09:00",
      close_time: "18:00",
    });
  });

  it("returns stable defaults when the salon row is missing", async () => {
    mockedFindSalonSettings.mockResolvedValue(null);
    mockedFindBusinessHours.mockResolvedValue([]);

    await expect(getSalonSettings("salon-1")).resolves.toMatchObject({
      salonName: "",
      timezone: "America/Panama",
      theme: "violet",
      bgStyle: "neutral",
    });
  });
});
