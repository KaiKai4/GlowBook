import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExpenseCategory } from "../schemas";

type AnySupabase = {
  from: (table: string) => QueryBuilder;
};

type QueryResult = {
  data: unknown;
  error: Error | null;
  count?: number | null;
};

type QueryBuilder = PromiseLike<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  insert: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (...args: unknown[]) => QueryBuilder;
};

function db(client: unknown): AnySupabase {
  return client as AnySupabase;
}

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

interface HistoricalExpensePayload {
  expenseGroups?: Array<{ amount: number }> | null;
  purchaseMonths?: Array<{ amount: number }> | null;
}

export interface LifetimeExpenseTotals {
  manual: number;
  inventoryPurchases: number;
  total: number;
}

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
  }
): Promise<void> {
  const supabase = db(await createSupabaseServerClient());
  // custom_category solo guarda el texto libre del caso "other"; para las demas
  // categorias la etiqueta sale del catalogo, no de un texto guardado.
  const customCategory = input.category === "other" ? input.concept?.trim() || null : null;

  const { error } = await supabase.from("expenses").insert({
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

  if (error) throw error;
}

export async function findExpenses(salonId: string, limit = 40): Promise<ExpenseRow[]> {
  const supabase = db(await createSupabaseServerClient());
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_monthly_history", {
    p_salon_id: salonId,
    p_start: "0001-01-01T00:00:00.000Z",
    p_end: "9999-12-31T23:59:59.999Z",
    p_timezone: "UTC",
  });

  if (error) throw error;

  const history = (data ?? {}) as HistoricalExpensePayload;
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

export async function sumExpensesTotal(
  salonId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("expenses")
    .select("amount")
    .eq("salon_id", salonId)
    .gte("expense_date", fromDate)
    .lte("expense_date", toDate);

  if (error) throw error;
  return ((data ?? []) as Array<{ amount: number | string }>).reduce((sum: number, row) => {
    return sum + Number(row.amount ?? 0);
  }, 0);
}
