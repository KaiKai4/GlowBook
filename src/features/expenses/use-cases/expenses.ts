import { err, ok, type Result } from "@/lib/result";
import type { CreateExpenseInput } from "../schemas";
import { findExpenses, insertExpense } from "../data/expenses.repo";
import { findInventoryPurchaseHistory } from "@/features/inventory/data/inventory.repo";
import { recordInventoryPurchase } from "@/features/inventory/use-cases/inventory-movements";
import type { InventoryPurchaseInput } from "@/features/inventory/schemas";

export interface ExpensesPageView {
  history: ExpenseHistoryItem[];
  monthTotal: number;
  manualTotal: number;
  inventoryPurchaseTotal: number;
}

export interface ExpenseHistoryItem {
  id: string;
  type: "manual" | "inventory_purchase";
  date: string;
  amount: number;
  concept: string;
  commerceName: string | null;
  note: string | null;
  createdAt: string;
  detail: string;
}

export async function getExpensesPage(salonId: string): Promise<ExpensesPageView> {
  const [expenses, purchases] = await Promise.all([
    findExpenses(salonId),
    findInventoryPurchaseHistory(salonId),
  ]);

  const manualHistory: ExpenseHistoryItem[] = expenses.map((expense) => ({
    id: expense.id,
    type: "manual",
    date: expense.expense_date,
    amount: Number(expense.amount ?? 0),
    concept: expense.concept || expense.custom_category || "Gasto general",
    commerceName: expense.vendor_name,
    note: expense.note,
    createdAt: expense.created_at,
    detail: expense.note || "Gasto general",
  }));

  const purchaseHistory: ExpenseHistoryItem[] = purchases.map((purchase) => {
    const itemNames = (purchase.inventory_purchase_items ?? [])
      .map((item) => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product;
        return product?.name;
      })
      .filter(Boolean)
      .join(", ");

    return {
      id: purchase.id,
      type: "inventory_purchase",
      date: purchase.purchase_date,
      amount: Number(purchase.total_cost ?? 0),
      concept: "Compra de inventario",
      commerceName: purchase.supplier_name,
      note: purchase.note,
      createdAt: purchase.created_at,
      detail: itemNames || purchase.note || "Compra de productos",
    };
  });

  const history = [...manualHistory, ...purchaseHistory].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthTotal = history.reduce((sum, expense) => {
    const date = new Date(`${expense.date}T12:00:00`);
    if (date.getFullYear() !== year || date.getMonth() !== month) return sum;
    return sum + expense.amount;
  }, 0);

  return {
    history,
    monthTotal,
    manualTotal: manualHistory.reduce((sum, expense) => sum + expense.amount, 0),
    inventoryPurchaseTotal: purchaseHistory.reduce((sum, expense) => sum + expense.amount, 0),
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
