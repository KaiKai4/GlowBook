// Catalogo de categorias de gasto de un salon. Funciones puras: sin I/O.
// "other" es el comodin para gastos que no encajan; admite un texto libre
// (custom_category) que la UI muestra en vez de la etiqueta generica.

export const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "products",
  "tools",
  "payroll",
  "commissions",
  "marketing",
  "maintenance",
  "taxes",
  "supplies",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Alquiler",
  utilities: "Servicios básicos",
  products: "Productos e insumos",
  tools: "Herramientas y equipo",
  payroll: "Salarios",
  commissions: "Comisiones",
  marketing: "Publicidad y marketing",
  maintenance: "Mantenimiento",
  taxes: "Impuestos",
  supplies: "Suministros",
  other: "Otro",
};

const EXPENSE_CATEGORY_SET = new Set<string>(EXPENSE_CATEGORIES);

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return EXPENSE_CATEGORY_SET.has(value);
}

/**
 * Etiqueta a mostrar para un gasto: para "other" con texto libre se usa ese
 * texto; en cualquier otro caso la etiqueta de la categoria.
 */
export function expenseDisplayLabel(
  category: ExpenseCategory,
  customCategory: string | null | undefined
): string {
  if (category === "other") {
    const custom = customCategory?.trim();
    if (custom) return custom;
  }
  return EXPENSE_CATEGORY_LABELS[category];
}
