import { err, ok, type Result } from "@/lib/result";
import type { CreateExpenseInput } from "../schemas";
import {
  findExpenses,
  findLifetimeExpenseTotals,
  insertExpense,
} from "../data/expenses.repo";
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
import { getInventoryPurchaseExpenseHistory } from "@/features/inventory/use-cases/inventory-purchase-expenses";
import { recordInventoryPurchase } from "@/features/inventory/use-cases/inventory-movements";
import type { InventoryPurchaseInput } from "@/features/inventory/schemas";

export interface ExpensesPageView {
  history: ExpenseHistoryItem[];
  /** Egresos del mes calendario en curso. */
  monthTotal: number;
  /** Egresos acumulados de toda la vida del salon (manuales + compras). */
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

function isInCurrentMonth(dateIso: string, now: Date): boolean {
  const date = new Date(`${dateIso}T12:00:00`);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export async function getExpensesPage(salonId: string): Promise<ExpensesPageView> {
  const [expenses, inventoryPurchaseExpenses, lifetimeTotals] = await Promise.all([
    findExpenses(salonId),
    getInventoryPurchaseExpenseHistory(salonId),
    findLifetimeExpenseTotals(salonId),
  ]);

  const now = new Date();

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

  const monthTotal = history.reduce(
    (sum, expense) => (isInCurrentMonth(expense.date, now) ? sum + expense.amount : sum),
    0
  );

  // Desglose por categoria del mes: gastos manuales con su categoria + las
  // compras de inventario agrupadas bajo "Productos e insumos".
  const monthCategoryInput = [
    ...expenses
      .filter((expense) => isInCurrentMonth(expense.expense_date, now))
      .map((expense) => ({
        category: expense.category as ExpenseCategory,
        customCategory: expense.custom_category,
        amount: Number(expense.amount ?? 0),
      })),
    ...inventoryPurchaseExpenses
      .filter((purchase) => isInCurrentMonth(purchase.date, now))
      .map((purchase) => ({
        category: "products" as ExpenseCategory,
        customCategory: null,
        amount: purchase.amount,
      })),
  ];
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
  input: CreateExpenseInput
): Promise<Result<string>> {
  try {
    await insertExpense(salonId, input);
    return ok("Gasto registrado.");
  } catch (error) {
    return err(error instanceof Error ? error.message : "No se pudo registrar el gasto.");
  }
}

export async function createInventoryPurchaseExpense(
  salonId: string,
  input: InventoryPurchaseInput
): Promise<Result<string>> {
  const result = await recordInventoryPurchase(salonId, {
    ...input,
    location: "storage",
  });

  return result.ok ? ok("Compra de inventario registrada.") : result;
}
