import { z } from "@/lib/validation/zod";
import { isValidOptionalPhone, phoneValidationMessage } from "@/lib/utils/phone";

const OptionalPhoneSchema = z
  .string()
  .max(30)
  .optional()
  .nullable()
  .refine(isValidOptionalPhone, phoneValidationMessage());

export const CreateCustomerSchema = z.object({
  first_name: z.string().min(1, "El nombre es obligatorio").max(100),
  last_name: z.string().min(1, "El apellido es obligatorio").max(100),
  phone: OptionalPhoneSchema,
  email: z.string().email("Email inválido").max(255).optional().nullable(),
  birth_date: z.string().date().optional().nullable(),
  notes: z.string().max(2000).optional().default(""),
  is_temporary: z.boolean().optional().default(false),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
