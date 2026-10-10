import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { findPendingConfirmationRows } from "../data/dashboard.repo";
import {
  fetchDashboardMetrics,
  fetchMonthlyAppointmentSeries,
  fetchTopServices,
} from "../data/rpc/dashboard-read-models.rpc";
import { getDashboardOverview } from "./get-dashboard-overview";

vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(),
}));
vi.mock("../data/dashboard.repo", () => ({
  findPendingConfirmationRows: vi.fn(),
}));
vi.mock("../data/rpc/dashboard-read-models.rpc", () => ({
  fetchDashboardMetrics: vi.fn(),
  fetchMonthlyAppointmentSeries: vi.fn(),
  fetchTopServices: vi.fn(),
}));

const mockedGetSalon = vi.mocked(getSalonIdentity);
const mockedPending = vi.mocked(findPendingConfirmationRows);
const mockedMetrics = vi.mocked(fetchDashboardMetrics);
const mockedSeries = vi.mocked(fetchMonthlyAppointmentSeries);
const mockedTopServices = vi.mocked(fetchTopServices);

const NOW = new Date("2026-06-12T12:00:00.000Z");

const ZERO_METRICS = {
  todayAppointments: 0,
  appointmentRevenue: 0,
  retailRevenue: 0,
  manualExpenses: 0,
  inventoryPurchases: 0,
  lowStockProducts: 0,
  totalCustomers: 0,
  completedThisMonth: 0,
  monthRevenue: 0,
  monthExpenses: 0,
  estimatedProfit: 0,
};

describe("get dashboard overview (ramas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSalon.mockResolvedValue({ name: "Glow", timezone: "UTC", payment_methods: [] });
    mockedMetrics.mockResolvedValue(ZERO_METRICS);
    mockedSeries.mockResolvedValue([]);
    mockedTopServices.mockResolvedValue([]);
    mockedPending.mockResolvedValue([]);
  });

  it("no consulta datos cuando ambas secciones están desactivadas", async () => {
    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: false, wantsConfirmations: false, now: NOW });

    expect(view).toEqual({ metrics: null, topServices: [], monthlyCompletedAppointments: [], pending: [] });
    expect(mockedGetSalon).not.toHaveBeenCalled();
    expect(mockedMetrics).not.toHaveBeenCalled();
    expect(mockedSeries).not.toHaveBeenCalled();
    expect(mockedTopServices).not.toHaveBeenCalled();
  });

  it("solo carga confirmaciones pendientes cuando los reportes están desactivados", async () => {
    mockedPending.mockResolvedValue([{ id: "a2", start_time: null, customer: null }]);

    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: false, wantsConfirmations: true, now: NOW });

    expect(view.pending).toEqual([{ id: "a2", customerName: "Cliente", phone: null, when: "" }]);
    expect(mockedPending).toHaveBeenCalledWith("salon-1", NOW.toISOString());
    expect(mockedMetrics).not.toHaveBeenCalled();
  });

  it("calcula los indicadores del mes a partir de los agregados de la base", async () => {
    mockedMetrics.mockResolvedValue({
      ...ZERO_METRICS,
      todayAppointments: 4,
      totalCustomers: 30,
      appointmentRevenue: 100,
      completedThisMonth: 2,
      lowStockProducts: 2,
    });

    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });

    expect(view.metrics).toMatchObject({
      todayAppointments: 4,
      appointmentRevenue: 100,
      lowStockProducts: 2,
      totalCustomers: 30,
      completedThisMonth: 2,
    });
  });

  it("entrega los totales de dinero tal como los calcula la base, sin recalcularlos", async () => {
    mockedMetrics.mockResolvedValue({
      ...ZERO_METRICS,
      appointmentRevenue: 35.5,
      retailRevenue: 12.25,
      monthRevenue: 47.8,
      monthExpenses: 12.5,
      estimatedProfit: -1.7,
    });

    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });

    expect(view.metrics).toMatchObject({
      appointmentRevenue: 35.5,
      retailRevenue: 12.25,
      monthRevenue: 47.8,
      monthExpenses: 12.5,
      estimatedProfit: -1.7,
    });
  });

  it("conserva el orden y los porcentajes de los servicios principales devueltos por la base", async () => {
    mockedTopServices.mockResolvedValue([
      { name: "Corte", count: 3, pct: 100 },
      { name: "Extra", count: 1, pct: 100 / 3 },
    ]);

    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });

    expect(view.topServices).toEqual([
      { name: "Corte", count: 3, pct: 100 },
      { name: "Extra", count: 1, pct: 100 / 3 },
    ]);
  });

  it("muestra la serie de 12 meses con etiqueta y tendencia de la base", async () => {
    // Julio 2025 .. junio 2026. Junio: total 1 frente a 2 en mayo (tendencia a la baja).
    const totals = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1];
    const firstAbsolute = 2025 * 12 + 6;
    mockedSeries.mockResolvedValue(
      totals.map((total, index) => {
        const absolute = firstAbsolute + index;
        const monthKey = `${Math.floor(absolute / 12)}-${String((absolute % 12) + 1).padStart(2, "0")}`;
        const previous = index > 0 ? (totals[index - 1] ?? total) : total;
        const delta = total - previous;
        const trend: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
        return { monthKey, total, delta, trend };
      })
    );

    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });
    const months = view.monthlyCompletedAppointments;

    expect(months).toHaveLength(12);
    expect(months[0]?.monthKey).toBe("2025-07");
    expect(months.at(-1)).toMatchObject({ monthKey: "2026-06", total: 1, delta: -1, trend: "down" });
    expect(months.at(-2)).toMatchObject({ monthKey: "2026-05", total: 2, delta: 2, trend: "up" });
    expect(months.every((month) => month.label.length > 0)).toBe(true);
  });

  it("pasa la zona horaria del salón y la fecha de referencia a los agregados", async () => {
    mockedGetSalon.mockResolvedValue({ name: "Glow", timezone: "America/Panama", payment_methods: [] });

    await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });

    expect(mockedMetrics).toHaveBeenCalledWith({ timezone: "America/Panama", now: NOW });
    expect(mockedSeries).toHaveBeenCalledWith({ timezone: "America/Panama", now: NOW });
    expect(mockedTopServices).toHaveBeenCalledWith({ timezone: "America/Panama", now: NOW });
  });

  it("usa UTC cuando el salón no tiene zona horaria configurada", async () => {
    mockedGetSalon.mockResolvedValue(null);

    await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });

    expect(mockedMetrics).toHaveBeenCalledWith({ timezone: "UTC", now: NOW });
  });
});
