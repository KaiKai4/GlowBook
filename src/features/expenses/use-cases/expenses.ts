import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import type { CreateExpenseInput } from "../schemas";
import {
  findExpenses,
  findLifetimeExpenseTotals,
  insertExpense,
} from "../data/expenses.repo";
import { reportExpenseMonthTotalsRpc } from "../data/rpc/report-expense-month-totals";
import {
  EXPENSE_CATEGORY_LABELS,
  expenseDisplayLabel,
  type ExpenseCategory,
} from "../domain/categories";
import {
  aggregateByCategory,
  topCategory,
  type CategoryTotal,
} from "../domain/category-totals";
import {
  getInventoryPurchaseExpenseHistory,
  recordInventoryPurchase,
  type InventoryPurchaseInput,
} from "@/features/inventory";

export interface ExpensesPageView {
  history: ExpenseHistoryItem[];
  /** Egresos del mes calendario en curso. */
  monthTotal: number;
  /** Egresos acumulados de toda la vida del salón (manuales + compras). */
  lifetimeTotal: number;
  /** Desglose por categoria del mes en curso (mayor a menor). */
  categoryTotals: CategoryTotal[];
  /** Categoria con mayor gasto del mes, o null. */
  topCategory: CategoryTotal | null;
}

export interface ExpenseHistoryItem {
  id: string;
  type: "manual" | "inventory_purchase";
  date: string;
  amount: number;
  concept: string;
  /** Etiqueta de categoria (o texto libre en "other"; "Compra de inventario"). */
  categoryLabel: string;
  commerceName: string | null;
  receiptUrl: string | null;
  note: string | null;
  createdAt: string;
  detail: string;
}

/** Primer y ultimo dia (YYYY-MM-DD) del mes calendario de `now`. */
function currentMonthRange(now: Date): { from: string; to: string } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const pad = (value: number) => String(value).padStart(2, "0");
  const prefix = `${year}-${pad(month + 1)}`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { from: `${prefix}-01`, to: `${prefix}-${pad(lastDay)}` };
}

export async function getExpensesPage(salonId: string): Promise<ExpensesPageView> {
  const monthRange = currentMonthRange(new Date());
  const [expenses, inventoryPurchaseExpenses, lifetimeTotals, monthRows] = await Promise.all([
    findExpenses(salonId),
    getInventoryPurchaseExpenseHistory(salonId),
    findLifetimeExpenseTotals(salonId),
    reportExpenseMonthTotalsRpc({ salonId, ...monthRange }),
  ]);

  const manualHistory: ExpenseHistoryItem[] = expenses.map((expense) => ({
    id: expense.id,
    type: "manual",
    date: expense.expense_date,
    amount: Number(expense.amount ?? 0),
    concept: expense.concept || expense.custom_category || "Gasto general",
    categoryLabel: expenseDisplayLabel(expense.category, expense.custom_category),
    commerceName: expense.vendor_name,
    receiptUrl: expense.receipt_url,
    note: expense.note,
    createdAt: expense.created_at,
    detail: expense.note || "Gasto general",
  }));

  const purchaseHistory: ExpenseHistoryItem[] = inventoryPurchaseExpenses.map((purchase) => ({
    id: purchase.id,
    type: "inventory_purchase",
    date: purchase.date,
    amount: purchase.amount,
    concept: "Compra de inventario",
    categoryLabel: EXPENSE_CATEGORY_LABELS.products,
    commerceName: purchase.commerceName,
    receiptUrl: null,
    note: purchase.note,
    createdAt: purchase.createdAt,
    detail: purchase.detail,
  }));

  const history = [...manualHistory, ...purchaseHistory].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });

  // Totales del mes calculados en la base (sin el limite de la lista visible).
  // Incluyen los gastos manuales y las compras de inventario como "products".
  const monthCategoryInput = monthRows.map((row) => ({
    category: row.category as ExpenseCategory,
    customCategory: row.customCategory,
    amount: row.amount,
  }));
  const monthTotal = monthCategoryInput.reduce((sum, row) => sum + row.amount, 0);
  const categoryTotals = aggregateByCategory(monthCategoryInput);

  return {
    history,
    monthTotal,
    lifetimeTotal: lifetimeTotals.total,
    categoryTotals,
    topCategory: topCategory(categoryTotals),
  };
}

export async function createExpense(
  salonId: string,
  input: CreateExpenseInput,
  idempotencyKey: string
): Promise<Result<string>> {
  try {
    await insertExpense(salonId, input, idempotencyKey);
    return ok("Gasto registrado.");
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo registrar el gasto."));
  }
}

export async function createInventoryPurchaseExpense(
  salonId: string,
  input: InventoryPurchaseInput,
  idempotencyKey: string
): Promise<Result<string>> {
  const result = await recordInventoryPurchase(
    salonId,
    { ...input, location: "storage" },
    idempotencyKey
  );

  return result.ok ? ok("Compra de inventario registrada.") : result;
}
