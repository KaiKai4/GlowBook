import { z } from "zod";

export const CreateCategorySchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  description: z.string().max(500).optional().default(""),
  ordering: z.number().int().min(0).optional().default(0),
});

export const UpdateCategorySchema = CreateCategorySchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const CreateServiceSchema = z.object({
  category_id: z.string().uuid("Categoría inválida"),
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  description: z.string().max(500).optional().default(""),
  duration_minutes: z.number().int().min(1, "La duración debe ser al menos 1 minuto"),
  price: z.number().min(0, "El precio no puede ser negativo"),
});

export const UpdateServiceSchema = CreateServiceSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;
