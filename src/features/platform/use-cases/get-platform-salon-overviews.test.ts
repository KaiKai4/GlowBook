import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonOverviews } from "../data/salon-overviews.repo";
import { getPlatformSalonOverviews } from "./get-platform-salon-overviews";

vi.mock("../data/salon-overviews.repo", () => ({
  findSalonOverviews: vi.fn(),
}));

const mockedFindSalonOverviews = vi.mocked(findSalonOverviews);

describe("get platform salon overviews", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindSalonOverviews.mockResolvedValue([]);
  });

  it("keeps platform_salon_overviews as the read model and adds dashboard metrics", async () => {
    mockedFindSalonOverviews.mockResolvedValue([
      {
        id: "salon-1",
        name: "Glow A",
        is_active: true,
        appointment_count: 10,
      },
      {
        id: "salon-2",
        name: "Glow B",
        is_active: false,
        appointment_count: 5,
      },
    ] as never);

    const view = await getPlatformSalonOverviews();

    expect(mockedFindSalonOverviews).toHaveBeenCalledOnce();
    expect(view.metrics).toEqual({
      totalSalons: 2,
      activeSalons: 1,
      totalAppointments: 15,
    });
    expect(view.salons).toHaveLength(2);
  });
});
