import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "./categories";

export interface CategoryTotal {
  category: ExpenseCategory;
  label: string;
  amount: number;
}

export interface ExpenseAggregateInput {
  category: ExpenseCategory;
  customCategory: string | null;
  amount: number;
}

// Agrupa gastos por categoria y devuelve los totales ordenados de mayor a
// menor. "other" se desglosa por el texto libre para que "Otro" no se vuelva
// un cajon de sastre opaco.
export function aggregateByCategory(expenses: ExpenseAggregateInput[]): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();

  for (const expense of expenses) {
    const customLabel = expense.category === "other" ? expense.customCategory?.trim() : undefined;
    const key = customLabel ? `other:${customLabel}` : expense.category;
    const label = customLabel || EXPENSE_CATEGORY_LABELS[expense.category];

    const existing = totals.get(key);
    if (existing) {
      existing.amount += expense.amount;
    } else {
      totals.set(key, { category: expense.category, label, amount: expense.amount });
    }
  }

  return [...totals.values()].sort(
    (a, b) => b.amount - a.amount || a.label.localeCompare(b.label)
  );
}

/** Categoria (etiqueta) con mayor gasto, o null si no hay gastos. */
export function topCategory(totals: CategoryTotal[]): CategoryTotal | null {
  return totals[0] ?? null;
}
