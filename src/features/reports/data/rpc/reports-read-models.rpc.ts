import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "@/lib/validation/zod";
import type { ReportModuleAvailability } from "../../domain/analytics";

// Adaptadores tipados de las funciones SQL de lectura de reportes
// (supabase/migrations/20240101000066_read_models.sql). La base agrega en el rango
// completo, sin el tope de filas de PostgREST (max_rows = 1000): las cifras son completas.
// Aqui solo se invoca la funcion, se valida la forma del resultado y se devuelve tipado.

const periodTotalsSchema = z.object({
  revenue: z.number(),
  discounts: z.number(),
  retailRevenue: z.number(),
  grossRevenue: z.number(),
  manualExpenses: z.number(),
  inventoryPurchases: z.number(),
  totalExpenses: z.number(),
  estimatedProfit: z.number(),
  completedCount: z.number(),
  totalCount: z.number(),
  avgTicket: z.number(),
  noShowRate: z.number(),
  newCustomers: z.number(),
});

const breakdownEntitySchema = z.object({
  name: z.string(),
  count: z.number(),
  revenue: z.number(),
  pct: z.number(),
});

const operationalBreakdownSchema = z.object({
  statusBreakdown: z.array(
    z.object({
      status: z.string(),
      count: z.number(),
      pct: z.number(),
    })
  ),
  byEmployee: z.array(breakdownEntitySchema),
  byService: z.array(breakdownEntitySchema),
});

const commissionReportSchema = z.object({
  rows: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      appointments: z.number(),
      revenue: z.number(),
      commissionPct: z.number(),
      commission: z.number(),
    })
  ),
  totalRevenue: z.number(),
  totalCommission: z.number(),
});

export type PeriodTotals = z.infer<typeof periodTotalsSchema>;
export type OperationalBreakdown = z.infer<typeof operationalBreakdownSchema>;
export type CommissionReportRows = z.infer<typeof commissionReportSchema>;

export interface ReportPeriodInput {
  /** Dia local inicial (YYYY-MM-DD), inclusivo. */
  from: string;
  /** Dia local final (YYYY-MM-DD), inclusivo. */
  to: string;
  timezone: string;
  modules: ReportModuleAvailability;
}

export interface ReportDayRangeInput {
  from: string;
  to: string;
  timezone: string;
}

function modulesArgument(modules: ReportModuleAvailability) {
  return {
    inventory: modules.inventory,
    retail: modules.retail,
    expenses: modules.expenses,
  };
}

/** Totales del periodo (ingresos, gastos, ticket medio, no-show, clientes nuevos). */
export async function fetchPeriodTotals({ from, to, timezone, modules }: ReportPeriodInput): Promise<PeriodTotals> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_period_totals", {
    p_from: from,
    p_to: to,
    p_timezone: timezone,
    p_modules: modulesArgument(modules),
  });

  if (error) throw error;
  return periodTotalsSchema.parse(data);
}

/** Desgloses del periodo: estados de cita, empleados y servicios. */
export async function fetchOperationalBreakdown({ from, to, timezone }: ReportDayRangeInput): Promise<OperationalBreakdown> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_operational_breakdown", {
    p_from: from,
    p_to: to,
    p_timezone: timezone,
  });

  if (error) throw error;
  return operationalBreakdownSchema.parse(data);
}

/** Liquidacion de comisiones por empleado del periodo. */
export async function fetchCommissionReport({ from, to, timezone }: ReportDayRangeInput): Promise<CommissionReportRows> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_commissions", {
    p_from: from,
    p_to: to,
    p_timezone: timezone,
  });

  if (error) throw error;
  return commissionReportSchema.parse(data);
}
