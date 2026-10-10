import { toAmount } from "@/infra/format/money";
import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { parseRpcResponse } from "@/infra/supabase/rpc-response";
import { z } from "@/infra/validation/zod";

const MonthTotalRowSchema = z.object({
  category: z.string(),
  custom_category: z.string().nullish(),
  amount: z.union([z.number(), z.string()]).nullish(),
});

const MonthTotalsSchema = z.array(MonthTotalRowSchema).nullish();

export interface ExpenseMonthTotalRow {
  category: string;
  customCategory: string | null;
  amount: number;
}

export interface ReportExpenseMonthTotalsRpcInput {
  salonId: string;
  from: string;
  to: string;
}

/**
 * Totales del rango por categoria (gastos manuales + compras de inventario como "products").
 * Se calcula en la base, sin el limite de la lista visible. Vacio si no hay datos.
 */
export async function reportExpenseMonthTotalsRpc(
  input: ReportExpenseMonthTotalsRpcInput
): Promise<ExpenseMonthTotalRow[]> {
  const supabase = await createSupabaseServerClient();
  const response = await supabase.rpc("report_expense_month_totals", {
    p_salon_id: input.salonId,
    p_from: input.from,
    p_to: input.to,
  });
  const rows = parseRpcResponse("report_expense_month_totals", response, MonthTotalsSchema) ?? [];
  return rows.map((row) => ({
    category: row.category,
    customCategory: row.custom_category ?? null,
    amount: toAmount(row.amount),
  }));
}
