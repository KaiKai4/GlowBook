import { z } from "@/lib/validation/zod";

export const CreateEmployeeSchema = z.object({
  first_name: z.string().min(1, "El nombre es obligatorio").max(100),
  last_name: z.string().min(1, "El apellido es obligatorio").max(100),
  phone: z.string().max(30).optional().default(""),
  email: z.union([z.literal(""), z.string().email("Email inválido").max(255)]).optional().default(""),
  specialty: z.string().max(100).optional().default(""),
  commission_percentage: z.number().min(0).max(100).optional().default(0),
  hire_date: z.string().date().optional().nullable(),
  service_ids: z.array(z.string().uuid()).optional().default([]),
  category_ids: z.array(z.string().uuid()).optional().default([]),
});

export const WorkScheduleSchema = z.object({
  employee_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  is_active: z.boolean().optional().default(true),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & { is_active?: boolean };
export type WorkScheduleInput = z.infer<typeof WorkScheduleSchema>;
