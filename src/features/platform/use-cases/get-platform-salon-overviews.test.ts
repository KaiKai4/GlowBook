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
    const recent = new Date().toISOString();
    mockedFindSalonOverviews.mockResolvedValue([
      {
        id: "salon-1",
        name: "Glow A",
        is_active: true,
        appointment_count: 10,
        created_at: recent,
        last_appointment_at: recent,
      },
      {
        id: "salon-2",
        name: "Glow B",
        is_active: false,
        appointment_count: 5,
        created_at: recent,
        last_appointment_at: null,
      },
    ] as never);

    const view = await getPlatformSalonOverviews();

    expect(mockedFindSalonOverviews).toHaveBeenCalledOnce();
    expect(view.metrics).toEqual({
      totalSalons: 2,
      activeSalons: 1,
      totalAppointments: 15,
      dormantSalons: 0,
    });
    expect(view.salons).toHaveLength(2);
    expect(view.dormantSalons).toEqual([]);
  });

  it("flags active salons without recent appointments as dormant", async () => {
    mockedFindSalonOverviews.mockResolvedValue([
      {
        id: "salon-1",
        name: "Glow Dormido",
        is_active: true,
        appointment_count: 3,
        created_at: "2026-01-01T00:00:00.000Z",
        last_appointment_at: "2026-02-01T00:00:00.000Z",
      },
    ] as never);

    const view = await getPlatformSalonOverviews();

    expect(view.metrics.dormantSalons).toBe(1);
    expect(view.dormantSalons).toEqual([{ id: "salon-1", name: "Glow Dormido" }]);
  });
});
