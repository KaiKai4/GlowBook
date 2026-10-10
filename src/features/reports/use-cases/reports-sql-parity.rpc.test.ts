// Paridad SQL del historial, los acumulados y la exportacion contra la base LOCAL real.
//
// Se siembra un salon pequeno con fechas fijas (mayo y junio 2026): citas completadas, una
// agendada y una de no-show, ventas de vitrina, gastos, una compra de inventario y tres productos
// (uno agotado, uno bajo minimo y uno disponible). Los casos de uso llaman a las RPC reales de
// report_* y el resultado se compara con valores calculados A MANO sobre ese dataset.
// Al terminar se borran todas las filas sembradas.
import { describe, expect, it, vi } from "vitest";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createIntegrationUserClient,
  createSalonOwnerFixture,
  getSupabaseIntegrationEnv,
  type SalonOwnerFixture,
  type TestSupabaseClient,
} from "@/test/supabase-integration-fixtures";
import { getOperationalReport } from "./get-operational-report";
import { getReportExportData } from "./get-report-export";

const serverClient = vi.hoisted(() => ({ current: null as TestSupabaseClient | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const integrationEnv = getSupabaseIntegrationEnv();
const NOW = new Date("2026-06-15T12:00:00.000Z");
const ALL_MODULES = { inventory: true, retail: true, expenses: true };
const NO_RETAIL = { inventory: true, retail: false, expenses: true };

interface SeededIds {
  shampooId: string;
  cremaId: string;
  tinteId: string;
}

function ensureOk(error: unknown): void {
  if (error) throw error;
}

function utc(day: string, hour: number): string {
  return `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

function zeros(count: number): number[] {
  return Array.from({ length: count }, () => 0);
}

// Salon en America/Panama (UTC-5, sin horario de verano): 15 UTC = 10:00 local, 18 UTC = 13:00 local.
async function insertAppointment(
  admin: TestSupabaseClient,
  fixture: SalonOwnerFixture,
  startIso: string,
  status: "completed" | "scheduled" | "no_show"
): Promise<void> {
  const start = new Date(startIso);
  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      salon_id: fixture.salonId,
      customer_id: fixture.customerId,
      created_by: fixture.userId,
      notes: "Paridad SQL",
      status: "scheduled",
    })
    .select("id")
    .single();
  ensureOk(error);
  if (!appointment) throw new Error("Cita no creada");

  const itemResult = await admin.from("appointment_items").insert({
    salon_id: fixture.salonId,
    appointment_id: appointment.id,
    service_id: fixture.serviceId,
    employee_id: fixture.employeeId,
    start_time: start.toISOString(),
    end_time: new Date(start.getTime() + 30 * 60_000).toISOString(),
    duration_minutes: 30,
    price: 15,
    ordering: 1,
    blocks_calendar: true,
  });
  ensureOk(itemResult.error);

  if (status !== "scheduled") {
    const statusResult = await admin.from("appointments").update({ status }).eq("id", appointment.id);
    ensureOk(statusResult.error);
  }
}

async function insertProduct(
  admin: TestSupabaseClient,
  salonId: string,
  name: string,
  stock: { location: "retail" | "internal"; quantity: number; minimum: number }
): Promise<string> {
  const { data, error } = await admin.from("inventory_products").insert({ salon_id: salonId, name }).select("id").single();
  ensureOk(error);
  if (!data) throw new Error("Producto no creado");
  const stockResult = await admin.from("inventory_stock_locations").insert({
    salon_id: salonId,
    product_id: data.id,
    location: stock.location,
    quantity: stock.quantity,
    minimum_quantity: stock.minimum,
  });
  ensureOk(stockResult.error);
  return data.id;
}

// Venta de vitrina de una linea. Por defecto el created_at de la linea es la fecha de venta.
// Los casos de registro tardio pasan createdAt distinto para comprobar que report_product_sales
// filtra por la fecha de venta de la cabecera y no por la fecha de registro de la linea.
async function insertRetailSale(
  admin: TestSupabaseClient,
  salonId: string,
  productId: string,
  sale: { saleDate: string; total: number; quantity: number; createdAt?: string }
): Promise<void> {
  const { data, error } = await admin
    .from("retail_sales")
    .insert({ salon_id: salonId, sale_date: sale.saleDate, total_amount: sale.total, payment_method: "cash" })
    .select("id")
    .single();
  ensureOk(error);
  if (!data) throw new Error("Venta no creada");
  const itemResult = await admin.from("retail_sale_items").insert({
    salon_id: salonId,
    sale_id: data.id,
    product_id: productId,
    location: "retail",
    quantity: sale.quantity,
    unit_price: sale.total / sale.quantity,
    total_price: sale.total,
    created_at: sale.createdAt ?? sale.saleDate,
  });
  ensureOk(itemResult.error);
}

async function seedDataset(admin: TestSupabaseClient, fixture: SalonOwnerFixture): Promise<SeededIds> {
  // Citas: mayo (2 completadas); junio (1 completada, 1 agendada, 1 no-show).
  await insertAppointment(admin, fixture, utc("2026-05-05", 15), "completed");
  await insertAppointment(admin, fixture, utc("2026-05-20", 15), "completed");
  await insertAppointment(admin, fixture, utc("2026-06-10", 15), "completed");
  await insertAppointment(admin, fixture, utc("2026-06-12", 18), "scheduled");
  await insertAppointment(admin, fixture, utc("2026-06-18", 17), "no_show");

  const shampooId = await insertProduct(admin, fixture.salonId, "Shampoo", { location: "retail", quantity: 1, minimum: 2 });
  const cremaId = await insertProduct(admin, fixture.salonId, "Crema", { location: "retail", quantity: 10, minimum: 3 });
  const tinteId = await insertProduct(admin, fixture.salonId, "Tinte", { location: "internal", quantity: 0, minimum: 0 });

  // Vitrina: mayo Shampoo 2 uds (50); junio Shampoo 3 uds (45) y Crema 4 uds (20).
  await insertRetailSale(admin, fixture.salonId, shampooId, { saleDate: utc("2026-05-12", 16), total: 50, quantity: 2 });
  await insertRetailSale(admin, fixture.salonId, shampooId, { saleDate: utc("2026-06-08", 16), total: 45, quantity: 3 });
  await insertRetailSale(admin, fixture.salonId, cremaId, { saleDate: utc("2026-06-20", 16), total: 20, quantity: 4 });

  // Gastos: alquiler en mayo (150), luz en junio (40). Compra de inventario en junio (30).
  const expensesResult = await admin.from("expenses").insert([
    { salon_id: fixture.salonId, category: "rent", concept: "Alquiler", amount: 150, expense_date: "2026-05-01" },
    { salon_id: fixture.salonId, category: "utilities", concept: "Luz", amount: 40, expense_date: "2026-06-05" },
  ]);
  ensureOk(expensesResult.error);
  const purchasesResult = await admin
    .from("inventory_purchases")
    .insert({ salon_id: fixture.salonId, total_cost: 30, purchase_date: "2026-06-03" });
  ensureOk(purchasesResult.error);

  return { shampooId, cremaId, tinteId };
}

// Borra las filas sembradas (hijos antes que padres) antes de borrar el salon.
async function cleanupDataset(admin: TestSupabaseClient, salonId: string): Promise<void> {
  ensureOk((await admin.from("retail_sale_items").delete().eq("salon_id", salonId)).error);
  ensureOk((await admin.from("retail_sales").delete().eq("salon_id", salonId)).error);
  ensureOk((await admin.from("inventory_stock_locations").delete().eq("salon_id", salonId)).error);
  ensureOk((await admin.from("inventory_products").delete().eq("salon_id", salonId)).error);
  ensureOk((await admin.from("inventory_purchases").delete().eq("salon_id", salonId)).error);
  ensureOk((await admin.from("expenses").delete().eq("salon_id", salonId)).error);
  ensureOk((await admin.from("appointment_items").delete().eq("salon_id", salonId)).error);
  ensureOk((await admin.from("appointments").delete().eq("salon_id", salonId)).error);
}

describe("paridad SQL de historial, acumulados y exportacion contra la base local", () => {
  it("historial, acumulado, desgloses y exportaciones coinciden con el dataset calculado a mano", async () => {
    const admin = createIntegrationAdminClient(integrationEnv);
    const user = createIntegrationUserClient(integrationEnv);
    let fixture: SalonOwnerFixture | null = null;

    try {
      fixture = await createSalonOwnerFixture(admin, "Paridad SQL");
      const ids = await seedDataset(admin, fixture);

      const { error: signInError } = await user.auth.signInWithPassword({
        email: fixture.email,
        password: fixture.password,
      });
      expect(signInError).toBeNull();
      serverClient.current = user;

      // --- Periodo "mes" (junio 2026) y acumulado del año, con las RPC reales. ---
      // Rango explicito de junio completo: el preset "mes" solo llega hasta el dia de NOW.
      const report = await getOperationalReport({
        salonId: fixture.salonId,
        filters: { preset: "mes", from: "2026-06-01", to: "2026-06-30" },
        now: NOW,
      });

      expect(report.from).toBe("2026-06-01");
      expect(report.to).toBe("2026-06-30");
      expect(report.revenue).toBe(15);
      expect(report.retailRevenue).toBe(65);
      expect(report.grossRevenue).toBe(80);
      expect(report.manualExpenses).toBe(40);
      expect(report.inventoryPurchases).toBe(30);
      expect(report.totalExpenses).toBe(70);
      expect(report.estimatedProfit).toBe(10);
      expect(report.completedCount).toBe(1);
      expect(report.totalCount).toBe(3);
      expect(report.avgTicket).toBe(15);
      expect(report.noShowRate).toBeCloseTo(100 / 3);
      const statuses = Object.fromEntries(report.statusBreakdown.map((row) => [row.status, row.count]));
      expect(statuses).toEqual({ completed: 1, scheduled: 1, no_show: 1 });

      expect(report.selectedYear).toBe(2026);
      expect(report.yearly).toEqual({
        appointmentRevenue: 45,
        retailRevenue: 115,
        grossRevenue: 160,
        operationalExpenses: 190,
        inventoryPurchases: 30,
        totalExpenses: 220,
        estimatedProfit: -60,
        completedAppointments: 3,
      });

      // --- Historial de 12 meses (2025-07 a 2026-06): solo mayo y junio tienen movimientos. ---
      const months = report.analytics.months;
      expect(months).toHaveLength(12);
      const byKey = Object.fromEntries(months.map((month) => [month.monthKey, month]));
      expect(byKey["2026-05"]).toMatchObject({
        completedAppointments: 2,
        appointmentRevenue: 30,
        retailRevenue: 50,
        totalRevenue: 80,
        operationalExpenses: 150,
        inventoryPurchases: 0,
        totalExpenses: 150,
        profit: -70,
        marginPct: -87.5,
      });
      expect(byKey["2026-06"]).toMatchObject({
        completedAppointments: 1,
        appointmentRevenue: 15,
        retailRevenue: 65,
        totalRevenue: 80,
        operationalExpenses: 40,
        inventoryPurchases: 30,
        totalExpenses: 70,
        profit: 10,
      });
      expect(byKey["2026-06"]?.marginPct).toBeCloseTo(12.5);
      const quietMonths = months.filter((month) => month.monthKey !== "2026-05" && month.monthKey !== "2026-06");
      expect(quietMonths).toHaveLength(10);
      for (const month of quietMonths) {
        expect(month).toMatchObject({ completedAppointments: 0, totalRevenue: 0, totalExpenses: 0, profit: 0, marginPct: 0 });
      }

      // Horas ocupadas (sin canceladas ni no-show): 10:00 local tiene 3 citas y 13:00 tiene 1.
      expect(report.analytics.busyHours).toEqual([
        { hour: 10, label: expect.any(String), total: 3 },
        { hour: 13, label: expect.any(String), total: 1 },
      ]);

      // Gastos principales: incluyen la reposicion de inventario.
      expect(report.analytics.topExpenses).toEqual([
        { label: "Alquiler", amount: 150 },
        { label: "Luz", amount: 40 },
        { label: "Reposiciones de inventario", amount: 30 },
      ]);

      // Productos: Shampoo 2 (mayo) + 3 (junio) = 5; Crema 4 (junio). Meses en orden de la ventana.
      expect(report.analytics.productSales).toEqual([
        { id: ids.shampooId, name: "Shampoo", total: 5, months: [...zeros(10), 2, 3] },
        { id: ids.cremaId, name: "Crema", total: 4, months: [...zeros(11), 4] },
      ]);

      // Alertas: Tinte agotado (0) y Shampoo bajo minimo (1 de 2). Crema esta disponible y no aparece.
      expect(report.analytics.inventoryAlerts).toEqual([
        { id: ids.tinteId, name: "Tinte", retail: 0, internal: 0, storage: 0, total: 0, minimum: 0, state: "agotado" },
        { id: ids.shampooId, name: "Shampoo", retail: 1, internal: 0, storage: 0, total: 1, minimum: 2, state: "bajo" },
      ]);

      // --- Exportacion historica: filas de mayo a junio (el mes actual es junio), totales y conceptos. ---
      const lifetime = await getReportExportData(fixture.salonId, ALL_MODULES, { type: "lifetime" }, NOW);
      expect(lifetime.months).toEqual([
        {
          label: expect.any(String),
          monthKey: "2026-05",
          completedAppointments: 2,
          appointmentRevenue: 30,
          retailRevenue: 50,
          grossRevenue: 80,
          operationalExpenses: 150,
          inventoryPurchases: 0,
          totalExpenses: 150,
          profit: -70,
        },
        {
          label: expect.any(String),
          monthKey: "2026-06",
          completedAppointments: 1,
          appointmentRevenue: 15,
          retailRevenue: 65,
          grossRevenue: 80,
          operationalExpenses: 40,
          inventoryPurchases: 30,
          totalExpenses: 70,
          profit: 10,
        },
      ]);
      expect(lifetime.totals).toEqual({
        appointmentRevenue: 45,
        retailRevenue: 115,
        grossRevenue: 160,
        operationalExpenses: 190,
        inventoryPurchases: 30,
        totalExpenses: 220,
        estimatedProfit: -60,
        completedAppointments: 3,
      });
      expect(lifetime.expenseConcepts).toEqual([
        { label: "Alquiler", amount: 150 },
        { label: "Luz", amount: 40 },
      ]);
      expect(lifetime.productTotals).toEqual([
        { name: "Shampoo", quantity: 5 },
        { name: "Crema", quantity: 4 },
      ]);

      // --- Exportacion anual 2026: desde el primer mes con movimientos (mayo) hasta diciembre. ---
      const yearly = await getReportExportData(fixture.salonId, ALL_MODULES, { type: "year", year: 2026 }, NOW);
      expect(yearly.months.map((row) => row.monthKey)).toEqual([
        "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
      ]);
      expect(yearly.months[1]).toMatchObject({ grossRevenue: 80, totalExpenses: 70, profit: 10 });
      expect(yearly.months.at(-1)).toMatchObject({ monthKey: "2026-12", grossRevenue: 0, profit: 0 });

      // --- Exportacion de un mes: solo mayo, con sus totales, conceptos y productos. ---
      const may = await getReportExportData(fixture.salonId, ALL_MODULES, { type: "month", monthKey: "2026-05" }, NOW);
      expect(may.months.map((row) => row.monthKey)).toEqual(["2026-05"]);
      expect(may.totals).toEqual({
        appointmentRevenue: 30,
        retailRevenue: 50,
        grossRevenue: 80,
        operationalExpenses: 150,
        inventoryPurchases: 0,
        totalExpenses: 150,
        estimatedProfit: -70,
        completedAppointments: 2,
      });
      expect(may.expenseConcepts).toEqual([{ label: "Alquiler", amount: 150 }]);
      expect(may.productTotals).toEqual([{ name: "Shampoo", quantity: 2 }]);

      // --- Modulo de tienda apagado: retail queda en cero y no hay productos vendidos. ---
      const noRetail = await getReportExportData(fixture.salonId, NO_RETAIL, { type: "lifetime" }, NOW);
      expect(noRetail.months.map((row) => row.monthKey)).toEqual(["2026-05", "2026-06"]);
      expect(noRetail.months.every((row) => row.retailRevenue === 0)).toBe(true);
      expect(noRetail.months[0]).toMatchObject({ grossRevenue: 30, profit: -120 });
      expect(noRetail.months[1]).toMatchObject({ grossRevenue: 15, profit: -55 });
      expect(noRetail.totals).toEqual({
        appointmentRevenue: 45,
        retailRevenue: 0,
        grossRevenue: 45,
        operationalExpenses: 190,
        inventoryPurchases: 30,
        totalExpenses: 220,
        estimatedProfit: -175,
        completedAppointments: 3,
      });
      expect(noRetail.productTotals).toEqual([]);
    } finally {
      serverClient.current = null;
      if (fixture) {
        await cleanupDataset(admin, fixture.salonId);
        await cleanupSalonOwnerFixture(admin, fixture);
      }
    }
  }, 60_000);

  it("report_product_sales cuenta una venta de junio registrada tarde (created_at en julio) en junio", async () => {
    const admin = createIntegrationAdminClient(integrationEnv);
    const user = createIntegrationUserClient(integrationEnv);
    let fixture: SalonOwnerFixture | null = null;

    try {
      fixture = await createSalonOwnerFixture(admin, "Paridad SQL registro tardio");
      const productId = await insertProduct(admin, fixture.salonId, "Acondicionador", {
        location: "retail",
        quantity: 5,
        minimum: 0,
      });
      // Venta con fecha de venta en junio pero registrada el 3 de julio: debe contar en junio.
      await insertRetailSale(admin, fixture.salonId, productId, {
        saleDate: utc("2026-06-20", 16),
        total: 25,
        quantity: 5,
        createdAt: utc("2026-07-03", 16),
      });

      const { error: signInError } = await user.auth.signInWithPassword({
        email: fixture.email,
        password: fixture.password,
      });
      expect(signInError).toBeNull();

      const { data, error } = await user.rpc("report_product_sales", {
        p_first_month: "2026-06",
        p_last_month: "2026-06",
        p_timezone: "America/Panama",
        p_modules: ALL_MODULES,
        p_limit: 5,
      });
      ensureOk(error);
      expect(data).toEqual([{ id: productId, name: "Acondicionador", total: 5, months: [5] }]);
    } finally {
      if (fixture) {
        await cleanupDataset(admin, fixture.salonId);
        await cleanupSalonOwnerFixture(admin, fixture);
      }
    }
  }, 60_000);
});
