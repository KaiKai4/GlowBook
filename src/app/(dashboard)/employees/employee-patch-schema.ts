import { z } from "@/infra/validation/zod";
import { CreateEmployeeSchema } from "@/features/employees/schemas";

// Parche de edición: sin .default() (heredado de CreateEmployeeSchema.partial()).
// Un campo que no llega al formulario queda fuera del UPDATE en vez de rellenarse
// con "" o 0 y pisar el valor guardado.
export const EmployeePatchSchema = z.object({
  first_name: CreateEmployeeSchema.shape.first_name.optional(),
  last_name: CreateEmployeeSchema.shape.last_name.optional(),
  phone: z.string().max(30).optional(),
  email: z.union([z.literal(""), z.string().email("Email inválido").max(255)]).optional(),
  specialty: z.string().max(100).optional(),
  commission_percentage: z.number().min(0).max(100).optional(),
  service_ids: z.array(z.string().uuid()).optional(),
  category_ids: z.array(z.string().uuid()).optional(),
});
