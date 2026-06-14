import { z } from "zod";
import { EXPENSE_CATEGORIES } from "./domain/categories";

export {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  expenseDisplayLabel,
  isExpenseCategory,
  type ExpenseCategory,
} from "./domain/categories";

export const CreateExpenseSchema = z
  .object({
    expense_date: z.string().min(1, "La fecha es obligatoria."),
    amount: z.coerce.number().positive("El monto debe ser mayor que 0."),
    category: z.enum(EXPENSE_CATEGORIES).default("other"),
    // Texto libre solo relevante cuando la categoria es "other".
    concept: z.string().trim().max(120).optional().default(""),
    vendor_name: z.string().trim().max(120).optional().default(""),
    receipt_url: z.string().trim().url("Enlace de comprobante inválido.").max(500).optional().or(z.literal("")),
    note: z.string().trim().max(500).optional().default(""),
  })
  .refine(
    (value) => value.category !== "other" || value.concept.trim().length > 0,
    { message: "Describe el concepto del gasto.", path: ["concept"] }
  );

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
