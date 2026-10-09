import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { ExpenseCategory } from "../schemas";
import { reportMonthlyHistoryRpc } from "./rpc/report-monthly-history";

export interface ExpenseRow {
  id: string;
  expense_date: string;
  amount: number | string;
  category: ExpenseCategory;
  custom_category: string | null;
  concept: string | null;
  vendor_name: string | null;
  receipt_url: string | null;
  note: string | null;
  created_at: string;
}

const EXPENSE_COLUMNS =
  "id, expense_date, amount, category, custom_category, concept, vendor_name, receipt_url, note, created_at";

export interface LifetimeExpenseTotals {
  manual: number;
  inventoryPurchases: number;
  total: number;
}

const UNIQUE_VIOLATION = "23505";

/**
 * Inserta el gasto usando idempotencyKey como id de la fila: un reenvio con la misma
 * clave no duplica el gasto. Si la fila ya existe en este salon se trata como exito.
 */
export async function insertExpense(
  salonId: string,
  input: {
    expense_date: string;
    amount: number;
    category: ExpenseCategory;
    concept?: string;
    vendor_name?: string;
    receipt_url?: string;
    note?: string;
  },
  idempotencyKey: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // custom_category solo guarda el texto libre del caso "other"; para las demas
  // categorias la etiqueta sale del catalogo, no de un texto guardado.
  const customCategory = input.category === "other" ? input.concept?.trim() || null : null;

  const { error } = await supabase.from("expenses").insert({
    id: idempotencyKey,
    salon_id: salonId,
    expense_date: input.expense_date,
    amount: input.amount,
    category: input.category,
    custom_category: customCategory,
    concept: input.concept?.trim() || null,
    vendor_name: input.vendor_name || null,
    receipt_url: input.receipt_url?.trim() || null,
    note: input.note || null,
  });

  if (!error) return;
  if (error.code !== UNIQUE_VIOLATION) throw error;

  // Reenvio: la fila ya existe. Solo cuenta como replay si pertenece a este salon.
  const { data, error: readError } = await supabase
    .from("expenses")
    .select("id")
    .eq("id", idempotencyKey)
    .eq("salon_id", salonId)
    .maybeSingle();

  if (readError) throw readError;
  if (!data) throw error;
}

export async function findExpenses(salonId: string, limit = 40): Promise<ExpenseRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("salon_id", salonId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ExpenseRow[];
}

export async function findLifetimeExpenseTotals(
  salonId: string
): Promise<LifetimeExpenseTotals> {
  const history = await reportMonthlyHistoryRpc({
    salonId,
    start: "0001-01-01T00:00:00.000Z",
    end: "9999-12-31T23:59:59.999Z",
    timezone: "UTC",
  });

  const manual = (history.expenseGroups ?? []).reduce(
    (sum, group) => sum + Number(group.amount ?? 0),
    0
  );
  const inventoryPurchases = (history.purchaseMonths ?? []).reduce(
    (sum, month) => sum + Number(month.amount ?? 0),
    0
  );

  return {
    manual,
    inventoryPurchases,
    total: manual + inventoryPurchases,
  };
}
