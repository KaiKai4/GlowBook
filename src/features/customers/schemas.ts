import { z } from "@/infra/validation/zod";
import { isValidOptionalPhone, phoneValidationMessage } from "@/infra/format/phone";

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

// Sin .default(): un campo ausente no debe pisar notes ni is_temporary guardados.
export const UpdateCustomerSchema = z.object({
  first_name: CreateCustomerSchema.shape.first_name.optional(),
  last_name: CreateCustomerSchema.shape.last_name.optional(),
  phone: CreateCustomerSchema.shape.phone,
  email: CreateCustomerSchema.shape.email,
  birth_date: CreateCustomerSchema.shape.birth_date,
  notes: z.string().max(2000).optional(),
  is_temporary: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
