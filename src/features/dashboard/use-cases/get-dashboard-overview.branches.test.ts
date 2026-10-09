import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalonIdentity } from "@/features/salon/use-cases/salon-identity";
import { getExternalOperationalMoney } from "@/features/finance/use-cases/operational-money";
import { getLowStockSummary } from "@/features/inventory/use-cases/low-stock-summary";
import {
  findDashboardReportRows,
  findPendingConfirmationRows,
  type DashboardReportRows,
} from "../data/dashboard.repo";
import { getDashboardOverview } from "./get-dashboard-overview";

vi.mock("@/features/salon/use-cases/salon-identity", () => ({
  getSalonIdentity: vi.fn(),
}));
vi.mock("@/features/finance/use-cases/operational-money", () => ({
  getExternalOperationalMoney: vi.fn(),
}));
vi.mock("@/features/inventory/use-cases/low-stock-summary", () => ({
  getLowStockSummary: vi.fn(),
}));
vi.mock("../data/dashboard.repo", () => ({
  findDashboardReportRows: vi.fn(),
  findPendingConfirmationRows: vi.fn(),
}));

const mockedGetSalon = vi.mocked(getSalonIdentity);
const mockedExternalMoney = vi.mocked(getExternalOperationalMoney);
const mockedLowStock = vi.mocked(getLowStockSummary);
const mockedReportRows = vi.mocked(findDashboardReportRows);
const mockedPending = vi.mocked(findPendingConfirmationRows);

const NOW = new Date("2026-06-12T12:00:00.000Z");

function emptyReportRows(overrides: Partial<DashboardReportRows> = {}): DashboardReportRows {
  return {
    todayAppointments: 0,
    monthAppointments: [],
    monthlyCompletedAppointments: [],
    totalCustomers: 0,
    bookedServices: [],
    ...overrides,
  };
}

type BookedRow = DashboardReportRows["bookedServices"][number];

function booked(name: string | null, status: string | null, asArray = false): BookedRow {
  const service = name === null ? null : { name };
  const appointment = status === null ? null : { status };
  return {
    service: asArray && service ? [service] : service,
    appointment: asArray && appointment ? [appointment] : appointment,
  };
}

describe("get dashboard overview (ramas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSalon.mockResolvedValue({ name: "Glow", timezone: "UTC", payment_methods: [] });
    mockedReportRows.mockResolvedValue(emptyReportRows());
    mockedPending.mockResolvedValue([]);
    mockedExternalMoney.mockResolvedValue({ retailRevenue: 0, manualExpenses: 0, inventoryPurchases: 0 });
    mockedLowStock.mockResolvedValue({ productCount: 0 } as Awaited<ReturnType<typeof getLowStockSummary>>);
  });

  it("no consulta datos cuando ambas secciones estan desactivadas", async () => {
    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: false, wantsConfirmations: false, now: NOW });

    expect(view).toEqual({ metrics: null, topServices: [], monthlyCompletedAppointments: [], pending: [] });
    expect(mockedGetSalon).not.toHaveBeenCalled();
    expect(mockedReportRows).not.toHaveBeenCalled();
  });

  it("solo carga confirmaciones pendientes cuando los reportes estan desactivados", async () => {
    mockedPending.mockResolvedValue([
      {
        id: "a1",
        start_time: "2026-06-13T14:00:00.000Z",
        customer: [{ first_name: "Ana", last_name: "Perez", phone: "61234567" }],
      },
    ]);

    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: false, wantsConfirmations: true, now: NOW });

    expect(view.metrics).toBeNull();
    expect(view.topServices).toEqual([]);
    expect(view.monthlyCompletedAppointments).toEqual([]);
    expect(view.pending).toEqual([
      expect.objectContaining({ id: "a1", customerName: "Ana Perez", phone: "61234567" }),
    ]);
    expect(mockedReportRows).not.toHaveBeenCalled();
    expect(mockedExternalMoney).not.toHaveBeenCalled();
    expect(mockedFindPendingSince()).toBe(NOW.toISOString());
  });

  it("muestra 'Cliente' sin telefono y hora vacia cuando la cita no tiene datos de cliente ni inicio", async () => {
    mockedPending.mockResolvedValue([{ id: "a2", start_time: null, customer: null }]);

    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: false, wantsConfirmations: true, now: NOW });

    expect(view.pending).toEqual([{ id: "a2", customerName: "Cliente", phone: null, when: "" }]);
  });

  it("calcula indicadores del mes y servicios principales excluyendo cancelados y no asistencias", async () => {
    mockedReportRows.mockResolvedValue(
      emptyReportRows({
        todayAppointments: 4,
        totalCustomers: 30,
        monthAppointments: [
          { total_price: 100, status: "completed" },
          { total_price: 0, status: "completed" },
        ],
        bookedServices: [
          booked("Corte", "completed"),
          booked("Corte", "completed", true),
          booked("Corte", "completed"),
          booked("Peinado", "scheduled"),
          booked("Color", "no_show"),
          booked("Lavado", "cancelled"),
          booked("Sin estado", null),
          booked(null, "completed"),
          booked("Keratina", "completed"),
          booked("Extra", "completed"),
          booked("Sexto", "completed"),
          booked("Septimo", "completed"),
        ],
      })
    );
    mockedLowStock.mockResolvedValue({ productCount: 2 } as Awaited<ReturnType<typeof getLowStockSummary>>);

    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });

    expect(view.metrics).toMatchObject({
      todayAppointments: 4,
      appointmentRevenue: 100,
      lowStockProducts: 2,
      totalCustomers: 30,
      completedThisMonth: 2,
    });
    expect(view.topServices.map((service) => [service.name, service.count])).toEqual([
      ["Corte", 3],
      ["Peinado", 1],
      ["Sin estado", 1],
      ["Keratina", 1],
      ["Extra", 1],
    ]);
    expect(view.topServices[0]?.pct).toBe(100);
    expect(view.topServices[4]?.pct).toBeCloseTo(100 / 3);
  });

  it("clasifica la tendencia mensual frente al mes anterior y omite citas sin fecha o fuera de la ventana", async () => {
    mockedReportRows.mockResolvedValue(
      emptyReportRows({
        monthlyCompletedAppointments: [
          { start_time: "2026-05-03T10:00:00.000Z" },
          { start_time: "2026-05-20T10:00:00.000Z" },
          { start_time: "2026-06-02T10:00:00.000Z" },
          { start_time: null },
          { start_time: "2024-01-10T10:00:00.000Z" },
        ],
      })
    );

    const view = await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });
    const months = view.monthlyCompletedAppointments;

    expect(months).toHaveLength(12);
    expect(months[0]?.monthKey).toBe("2025-07");
    expect(months.at(-1)).toMatchObject({ monthKey: "2026-06", total: 1, delta: -1, trend: "down" });
    expect(months.at(-2)).toMatchObject({ monthKey: "2026-05", total: 2, delta: 2, trend: "up" });
    expect(months.at(-3)).toMatchObject({ monthKey: "2026-04", total: 0, delta: 0, trend: "flat" });
    expect(months.every((month) => typeof month.label === "string" && month.label.length > 0)).toBe(true);
  });

  it("consulta ingresos externos y stock bajo del salon solo cuando se piden reportes", async () => {
    await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });

    expect(mockedExternalMoney).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: "salon-1", fromDate: "2026-06-01", toDate: "2026-06-12" })
    );
    expect(mockedLowStock).toHaveBeenCalledWith("salon-1");
  });

  it("usa UTC cuando el salon no tiene zona horaria configurada", async () => {
    mockedGetSalon.mockResolvedValue(null);

    await getDashboardOverview({ salonId: "salon-1", wantsReports: true, wantsConfirmations: false, now: NOW });

    expect(mockedReportRows).toHaveBeenCalledWith(
      expect.objectContaining({
        todayStart: "2026-06-12T00:00:00.000Z",
        todayEnd: "2026-06-12T23:59:59.999Z",
        monthStart: "2026-06-01T00:00:00.000Z",
      })
    );
  });
});

function mockedFindPendingSince(): string | undefined {
  const call = mockedPending.mock.calls[0];
  return call?.[1];
}
