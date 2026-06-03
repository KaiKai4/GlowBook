import { z } from "zod";

export const ExpenseCategorySchema = z.enum([
  "rent",
  "utilities",
  "supplies",
  "maintenance",
  "payroll",
  "other",
]);

export const CreateExpenseSchema = z.object({
  expense_date: z.string().min(1, "La fecha es obligatoria."),
  amount: z.coerce.number().positive("El monto debe ser mayor que 0."),
  concept: z.string().trim().min(1, "El concepto del gasto es obligatorio.").max(120),
  vendor_name: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Alquiler",
  utilities: "Servicios basicos",
  supplies: "Suministros",
  maintenance: "Mantenimiento",
  payroll: "Nomina/comisiones",
  other: "Otro / personalizado",
};
