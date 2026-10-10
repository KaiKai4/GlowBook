import { beforeEach, describe, expect, it, vi } from "vitest";
import { findBusinessHours } from "../data/salon-business-hours.repo";
import { getSalonBusinessHours } from "./salon-business-hours";

vi.mock("../data/salon-business-hours.repo", () => ({
  findBusinessHours: vi.fn(),
}));

const mockedFindBusinessHours = vi.mocked(findBusinessHours);

describe("getSalonBusinessHours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proyecta solo los campos de horario del salon consultado", async () => {
    mockedFindBusinessHours.mockResolvedValue([
      { day_of_week: 0, is_open: false, open_time: null, close_time: null },
      { day_of_week: 1, is_open: true, open_time: "09:00", close_time: "18:00" },
    ]);

    expect(await getSalonBusinessHours("salon-1")).toEqual([
      { day_of_week: 0, is_open: false, open_time: null, close_time: null },
      { day_of_week: 1, is_open: true, open_time: "09:00", close_time: "18:00" },
    ]);
    expect(mockedFindBusinessHours).toHaveBeenCalledWith("salon-1");
  });

  it("devuelve lista vacia cuando el salon no tiene horarios configurados", async () => {
    mockedFindBusinessHours.mockResolvedValue([]);

    expect(await getSalonBusinessHours("salon-1")).toEqual([]);
  });
});
