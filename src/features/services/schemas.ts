import { z } from "@/infra/validation/zod";

const PricingModeSchema = z.enum(["fixed", "variable"]);

export const CreateCategorySchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  description: z.string().max(500).optional().default(""),
  ordering: z.number().int().min(0).optional().default(0),
  pricing_mode: PricingModeSchema.optional().default("fixed"),
});

// Los schemas de actualización NO heredan .default(): un campo ausente debe quedar
// fuera del UPDATE (si no, se pisaría el valor guardado con su default).
export const UpdateCategorySchema = z.object({
  name: CreateCategorySchema.shape.name.optional(),
  description: z.string().max(500).optional(),
  ordering: z.number().int().min(0).optional(),
  pricing_mode: PricingModeSchema.optional(),
  is_active: z.boolean().optional(),
});

export const CreateServiceSchema = z.object({
  category_id: z.string().uuid("Categoría inválida"),
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  description: z.string().max(500).optional().default(""),
  duration_minutes: z.number().int().min(1, "La duración debe ser al menos 1 minuto"),
  price: z.number().min(0, "El precio no puede ser negativo"),
});

export const UpdateServiceSchema = z.object({
  category_id: CreateServiceSchema.shape.category_id.optional(),
  name: CreateServiceSchema.shape.name.optional(),
  description: z.string().max(500).optional(),
  duration_minutes: CreateServiceSchema.shape.duration_minutes.optional(),
  price: CreateServiceSchema.shape.price.optional(),
  is_active: z.boolean().optional(),
});

export type CreateCategoryInput = z.input<typeof CreateCategorySchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;
