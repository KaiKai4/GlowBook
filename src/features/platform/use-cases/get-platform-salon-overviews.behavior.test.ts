import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonOverviews } from "@/features/platform/data/salon-overviews.repo";
type PlatformSalonOverviewItem = Awaited<ReturnType<typeof findSalonOverviews>>[number];
import { getPlatformSalonOverviews } from "./get-platform-salon-overviews";

// Metricas de salud de la plataforma: un salón activo sin citas en mas de 30
// dias cuenta como dormido (riesgo de churn). La referencia es su ultima cita
// o, si nunca agendo, la fecha de creacion. Los salones inactivos no cuentan.

vi.mock("@/features/platform/data/salon-overviews.repo", () => ({
  findSalonOverviews: vi.fn(),
}));

const mockedFindOverviews = vi.mocked(findSalonOverviews);

const NOW = new Date("2026-06-30T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

function salon(overrides: Partial<PlatformSalonOverviewItem>): PlatformSalonOverviewItem {
  return {
    id: "salon-1",
    name: "Glow",
    email: "",
    contact_email: "",
    phone: "",
    is_active: true,
    created_at: daysBefore(365),
    disabled_features: [],
    owner_names: [],
    owner_count: 1,
    customer_count: 0,
    collaborator_count: 0,
    appointment_count: 0,
    service_count: 0,
    invitation_count: 0,
    last_appointment_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getPlatformSalonOverviews dormant salons", () => {
  it("flags an active salón whose last appointment is older than 30 days", async () => {
    mockedFindOverviews.mockResolvedValue([
      salon({ id: "dormido", name: "Dormido", last_appointment_at: daysBefore(45) }),
      salon({ id: "activo", name: "Activo", last_appointment_at: daysBefore(2) }),
    ]);

    const view = await getPlatformSalonOverviews();

    expect(view.dormantSalons).toEqual([{ id: "dormido", name: "Dormido" }]);
    expect(view.metrics.dormantSalons).toBe(1);
  });

  it("does not flag a salón whose last appointment is exactly 30 days old", async () => {
    mockedFindOverviews.mockResolvedValue([salon({ last_appointment_at: daysBefore(30) })]);

    const view = await getPlatformSalonOverviews();

    expect(view.metrics.dormantSalons).toBe(0);
  });

  it("uses the creation date as reference for salons that never scheduled an appointment", async () => {
    mockedFindOverviews.mockResolvedValue([
      salon({ id: "nuevo-reciente", created_at: daysBefore(10), last_appointment_at: null }),
      salon({ id: "nuevo-abandonado", created_at: daysBefore(31), last_appointment_at: null }),
    ]);

    const view = await getPlatformSalonOverviews();

    expect(view.dormantSalons.map((item) => item.id)).toEqual(["nuevo-abandonado"]);
  });

  it("never flags inactive salons, however long they have been idle", async () => {
    mockedFindOverviews.mockResolvedValue([
      salon({ id: "suspendido", is_active: false, last_appointment_at: daysBefore(200) }),
    ]);

    const view = await getPlatformSalonOverviews();

    expect(view.dormantSalons).toEqual([]);
    expect(view.metrics.dormantSalons).toBe(0);
  });
});

describe("getPlatformSalonOverviews metrics", () => {
  it("returns the salón rows unchanged alongside the aggregated metrics", async () => {
    const rows = [
      salon({ id: "a", appointment_count: 40, is_active: true }),
      salon({ id: "b", appointment_count: 2, is_active: false }),
      salon({ id: "c", appointment_count: 0, is_active: true }),
    ];
    mockedFindOverviews.mockResolvedValue(rows);

    const view = await getPlatformSalonOverviews();

    expect(view.salons).toBe(rows);
    expect(view.metrics).toEqual({
      totalSalons: 3,
      activeSalons: 2,
      totalAppointments: 42,
      dormantSalons: 2,
    });
  });

  it("reports zero metrics when the platform has no salons", async () => {
    mockedFindOverviews.mockResolvedValue([]);

    const view = await getPlatformSalonOverviews();

    expect(view).toEqual({
      salons: [],
      metrics: { totalSalons: 0, activeSalons: 0, totalAppointments: 0, dormantSalons: 0 },
      dormantSalons: [],
    });
  });

  it("propagates read failures from the data adapter", async () => {
    const readError = new Error("rpc down");
    mockedFindOverviews.mockRejectedValue(readError);

    await expect(getPlatformSalonOverviews()).rejects.toBe(readError);
  });
});
