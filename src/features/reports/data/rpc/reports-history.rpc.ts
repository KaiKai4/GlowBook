import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "@/lib/validation/zod";
import type { ReportModuleAvailability } from "../../domain/analytics";
import { modulesArgument, type ReportDayRangeInput } from "./reports-read-models.rpc";

// Adaptadores tipados de las funciones SQL de historial de
// supabase/migrations/20240101000066_read_models.sql. Cada una agrega en la base
// (sin tope de filas de PostgREST) y devuelve ya el formato de la grafica o la exportacion.

const monthlySeriesSchema = z.array(
  z.object({
    monthKey: z.string(),
    completedAppointments: z.number(),
    appointmentRevenue: z.number(),
    retailRevenue: z.number(),
    grossRevenue: z.number(),
    operationalExpenses: z.number(),
    inventoryPurchases: z.number(),
    totalExpenses: z.number(),
    profit: z.number(),
    marginPct: z.number(),
  })
);

const busyHoursSchema = z.array(z.object({ hour: z.number(), total: z.number() }));

const expenseConceptsSchema = z.array(z.object({ label: z.string(), amount: z.number() }));

const productSalesSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    total: z.number(),
    months: z.array(z.number()),
  })
);

const inventoryAlertsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    retail: z.number(),
    internal: z.number(),
    storage: z.number(),
    total: z.number(),
    minimum: z.number(),
    state: z.enum(["agotado", "bajo", "disponible"]),
  })
);

/** Fila mensual de report_monthly_series (meses en cero incluidos, orden cronologico). */
export type MonthlySeriesRow = z.infer<typeof monthlySeriesSchema>[number];
export type BusyHourRow = z.infer<typeof busyHoursSchema>[number];
export type ExpenseConceptRow = z.infer<typeof expenseConceptsSchema>[number];
export type ProductSalesRow = z.infer<typeof productSalesSchema>[number];
export type InventoryAlertRow = z.infer<typeof inventoryAlertsSchema>[number];

export interface MonthRangeInput {
  /** Mes inicial (YYYY-MM), inclusivo. */
  firstMonth: string;
  /** Mes final (YYYY-MM), inclusivo. */
  lastMonth: string;
  timezone: string;
  modules: ReportModuleAvailability;
}

/** Serie mensual continua entre dos meses: ingresos, gastos, beneficio y margen. */
export async function fetchMonthlySeries({
  firstMonth,
  lastMonth,
  timezone,
  modules,
}: MonthRangeInput): Promise<MonthlySeriesRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_monthly_series", {
    p_first_month: firstMonth,
    p_last_month: lastMonth,
    p_timezone: timezone,
    p_modules: modulesArgument(modules),
  });

  if (error) throw error;
  return monthlySeriesSchema.parse(data);
}

/** Citas por hora local del salon (excluye canceladas y no-show), orden ascendente. */
export async function fetchBusyHours({ from, to, timezone }: ReportDayRangeInput): Promise<BusyHourRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_busy_hours", {
    p_from: from,
    p_to: to,
    p_timezone: timezone,
  });

  if (error) throw error;
  return busyHoursSchema.parse(data);
}

export interface ExpenseConceptsInput {
  /** Dia local inicial (YYYY-MM-DD), inclusivo. */
  from: string;
  /** Dia local final (YYYY-MM-DD), inclusivo. */
  to: string;
  modules: ReportModuleAvailability;
  /** Anade "Reposiciones de inventario" con el total de compras del rango. */
  includeRestock: boolean;
  /** Top N por importe; sin valor devuelve todos los conceptos. */
  limit?: number;
}

/** Gastos agrupados por concepto, del mayor importe al menor. */
export async function fetchExpenseConcepts({
  from,
  to,
  modules,
  includeRestock,
  limit,
}: ExpenseConceptsInput): Promise<ExpenseConceptRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_expense_concepts", {
    p_from: from,
    p_to: to,
    p_modules: modulesArgument(modules),
    p_include_restock: includeRestock,
    ...(limit === undefined ? {} : { p_limit: limit }),
  });

  if (error) throw error;
  return expenseConceptsSchema.parse(data);
}

export interface ProductSalesInput extends MonthRangeInput {
  /** Top N productos por cantidad vendida en el rango. */
  limit: number;
}

/** Productos mas vendidos en vitrina, con la cantidad vendida por mes del rango. */
export async function fetchProductSales({
  firstMonth,
  lastMonth,
  timezone,
  modules,
  limit,
}: ProductSalesInput): Promise<ProductSalesRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_product_sales", {
    p_first_month: firstMonth,
    p_last_month: lastMonth,
    p_timezone: timezone,
    p_modules: modulesArgument(modules),
    p_limit: limit,
  });

  if (error) throw error;
  return productSalesSchema.parse(data);
}

/** Productos agotados o bajo minimo (total de todas las ubicaciones), del peor al mejor. */
export async function fetchInventoryAlerts(modules: ReportModuleAvailability): Promise<InventoryAlertRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_inventory_alerts", {
    p_modules: modulesArgument(modules),
  });

  if (error) throw error;
  return inventoryAlertsSchema.parse(data);
}
