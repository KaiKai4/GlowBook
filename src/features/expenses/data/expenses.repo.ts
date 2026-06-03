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
  note: string | null;
  created_at: string;
}

export async function insertExpense(
  salonId: string,
  input: {
    expense_date: string;
    amount: number;
    concept: string;
    vendor_name?: string;
    note?: string;
  }
): Promise<void> {
  const supabase = db(await createSupabaseServerClient());
  const { error } = await supabase.from("expenses").insert({
    salon_id: salonId,
    expense_date: input.expense_date,
    amount: input.amount,
    category: "other",
    custom_category: input.concept,
    concept: input.concept,
    vendor_name: input.vendor_name || null,
    note: input.note || null,
  });

  if (error) throw error;
}

export async function findExpenses(salonId: string, limit = 40): Promise<ExpenseRow[]> {
  const supabase = db(await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("expenses")
    .select("id, expense_date, amount, category, custom_category, concept, vendor_name, note, created_at")
    .eq("salon_id", salonId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ExpenseRow[];
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
