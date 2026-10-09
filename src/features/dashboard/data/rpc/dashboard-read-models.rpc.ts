import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { z } from "@/infra/validation/zod";

// Adaptadores tipados de las funciones SQL de lectura del dashboard
// (supabase/migrations/20240101000066_read_models.sql). Devuelven agregados ya calculados
// en la base; aqui solo se invoca la funcion y se valida la forma del resultado.

const dashboardMetricsSchema = z.object({
  todayAppointments: z.number(),
  appointmentRevenue: z.number(),
  retailRevenue: z.number(),
  manualExpenses: z.number(),
  inventoryPurchases: z.number(),
  lowStockProducts: z.number(),
  totalCustomers: z.number(),
  completedThisMonth: z.number(),
});

const monthlyAppointmentSeriesSchema = z.array(
  z.object({
    monthKey: z.string().regex(/^\d{4}-\d{2}$/),
    total: z.number(),
    delta: z.number(),
    trend: z.enum(["up", "down", "flat"]),
  })
);

const topServicesSchema = z.array(
  z.object({
    name: z.string(),
    count: z.number(),
    pct: z.number(),
  })
);

export type DashboardMetricsRow = z.infer<typeof dashboardMetricsSchema>;
export type MonthlyAppointmentSeriesRow = z.infer<typeof monthlyAppointmentSeriesSchema>[number];
export type TopServiceRow = z.infer<typeof topServicesSchema>[number];

export interface DashboardReadModelInput {
  timezone: string;
  now: Date;
}

async function callDashboardReadModel<T extends z.ZodType>(
  functionName: "report_dashboard_metrics" | "report_dashboard_monthly_appointments" | "report_dashboard_top_services",
  { timezone, now }: DashboardReadModelInput,
  schema: T
): Promise<z.infer<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(functionName, {
    p_timezone: timezone,
    p_now: now.toISOString(),
  });

  if (error) throw error;
  return schema.parse(data);
}

export function fetchDashboardMetrics(input: DashboardReadModelInput): Promise<DashboardMetricsRow> {
  return callDashboardReadModel("report_dashboard_metrics", input, dashboardMetricsSchema);
}

export function fetchMonthlyAppointmentSeries(
  input: DashboardReadModelInput
): Promise<MonthlyAppointmentSeriesRow[]> {
  return callDashboardReadModel("report_dashboard_monthly_appointments", input, monthlyAppointmentSeriesSchema);
}

export function fetchTopServices(input: DashboardReadModelInput): Promise<TopServiceRow[]> {
  return callDashboardReadModel("report_dashboard_top_services", input, topServicesSchema);
}
