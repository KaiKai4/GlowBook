// Paridad del reporte operativo contra la base LOCAL real (sustituye a la version con mocks).
//
// Se crea un dataset pequeno con el cliente admin (dos citas de hoy: una completada de 15 y una
// agendada de 15), se inicia sesion como owner y se ejecuta el caso de uso de reportes con las RPC
// reales (report_period_totals, report_operational_breakdown, report_commissions). El resultado se
// compara con los valores esperados calculados a mano sobre ese mismo dataset. Solo se simula el
// cliente de servidor, para que la sesion sea la del owner.
import { describe, expect, it, vi } from "vitest";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createIntegrationUserClient,
  createSalonOwnerFixture,
  createScheduledAppointmentFixture,
  getSupabaseIntegrationEnv,
  type SalonOwnerFixture,
  type TestSupabaseClient,
} from "@/test/supabase-integration-fixtures";
import { getOperationalReport } from "./get-operational-report";

const serverClient = vi.hoisted(() => ({ current: null as TestSupabaseClient | null }));
vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClient.current,
}));

const integrationEnv = getSupabaseIntegrationEnv();

describe("getOperationalReport contra la base local", () => {
  it("el informe del mes coincide con el dataset: una cita completada de 15 y una agendada de 15", async () => {
    const admin = createIntegrationAdminClient(integrationEnv);
    const user = createIntegrationUserClient(integrationEnv);
    let fixture: SalonOwnerFixture | null = null;

    try {
      fixture = await createSalonOwnerFixture(admin, "Paridad Reportes");
      const completed = await createScheduledAppointmentFixture(admin, fixture, { daysAhead: 0, hour: 15 });
      await createScheduledAppointmentFixture(admin, fixture, { daysAhead: 0, hour: 16 });

      const { error: statusError } = await admin
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", completed.appointmentId);
      expect(statusError).toBeNull();

      const { error: signInError } = await user.auth.signInWithPassword({
        email: fixture.email,
        password: fixture.password,
      });
      expect(signInError).toBeNull();
      serverClient.current = user;

      const report = await getOperationalReport({
        salonId: fixture.salonId,
        filters: { preset: "mes" },
      });

      // Ingresos y ticket: solo la cita completada cuenta como ingreso.
      expect(report.revenue).toBe(15);
      expect(report.avgTicket).toBe(15);
      expect(report.estimatedProfit).toBe(15);
      expect(report.retailRevenue).toBe(0);
      expect(report.inventoryPurchases).toBe(0);

      // Conteos: una completada de dos citas del periodo.
      expect(report.completedCount).toBe(1);
      expect(report.totalCount).toBe(2);
      expect(report.noShowRate).toBe(0);

      // Desgloses: el estado reparte 50% completada y 50% agendada.
      const statuses = Object.fromEntries(report.statusBreakdown.map((row) => [row.status, row]));
      expect(statuses.completed).toEqual(expect.objectContaining({ count: 1, pct: 50 }));
      expect(statuses.scheduled).toEqual(expect.objectContaining({ count: 1, pct: 50 }));

      // Por empleado y por servicio: solo la cita completada aporta ingresos.
      expect(report.byEmployee).toHaveLength(1);
      expect(report.byEmployee[0]).toEqual(expect.objectContaining({ count: 1, revenue: 15 }));
      expect(report.byService).toHaveLength(1);
      expect(report.byService[0]).toEqual(expect.objectContaining({ count: 1, revenue: 15 }));

      // Comisiones: el total de ingresos atribuidos coincide con el ingreso del periodo.
      expect(report.commissions.totalRevenue).toBe(15);
    } finally {
      serverClient.current = null;
      await cleanupSalonOwnerFixture(admin, fixture);
    }
  }, 60_000);
});
