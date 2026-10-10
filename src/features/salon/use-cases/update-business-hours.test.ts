import { captureError } from "@/infra/observability";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { upsertBusinessHours } from "../data/salon-business-hours.repo";
import { updateBusinessHours } from "./update-business-hours";
import type { BusinessDayInput } from "../schemas";

vi.mock("../data/salon-business-hours.repo", () => ({
  upsertBusinessHours: vi.fn(),
}));

const mockedUpsertBusinessHours = vi.mocked(upsertBusinessHours);

const hours: BusinessDayInput[] = [
  { day_of_week: 0, is_open: true, open_time: "09:00", close_time: "17:00" },
  { day_of_week: 1, is_open: false, open_time: "09:00", close_time: "17:00" },
];

describe("update business hours", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("normalizes closed days before passing rows to the salón adapter", async () => {
    mockedUpsertBusinessHours.mockResolvedValue(undefined);

    const result = await updateBusinessHours("salon-1", hours);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedUpsertBusinessHours).toHaveBeenCalledWith([
      {
        salon_id: "salon-1",
        day_of_week: 0,
        is_open: true,
        open_time: "09:00",
        close_time: "17:00",
      },
      {
        salon_id: "salon-1",
        day_of_week: 1,
        is_open: false,
        open_time: null,
        close_time: null,
      },
    ]);
  });

  it("returns a business error when persistence fails", async () => {
    mockedUpsertBusinessHours.mockRejectedValue(new Error("database unavailable"));

    await expect(updateBusinessHours("salon-1", hours)).resolves.toEqual({
      ok: false,
      error: "Error al guardar los horarios.",
    });
  });
});

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

describe("registro de errores de horario", () => {
  it("registra con captureError el fallo del upsert y devuelve el error de negocio", async () => {
    const dbError = new Error("database unavailable");
    mockedUpsertBusinessHours.mockRejectedValue(dbError);

    expect(await updateBusinessHours("salon-1", [])).toEqual({ ok: false, error: "Error al guardar los horarios." });
    expect(captureError).toHaveBeenCalledWith(dbError, { module: "salon", action: "update_business_hours" });
  });
});
