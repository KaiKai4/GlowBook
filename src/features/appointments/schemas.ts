import { z } from "@/lib/validation/zod";
import { normalizePaymentMethod } from "@/features/payments/domain/payment-methods";

const PaymentMethodSchema = z
  .string()
  .trim()
  .min(1, "El metodo de pago es obligatorio.")
  .max(64, "El metodo de pago no puede superar 64 caracteres.")
  .transform(normalizePaymentMethod);

const AssignmentSchema = z.object({
  service_id: z.string().uuid("ID de servicio inválido"),
  employee_id: z.string().uuid("ID de profesional inválido"),
});

export const CreateAppointmentSchema = z.object({
  customer_id: z.string().uuid("ID de cliente inválido"),
  start_time: z.string().datetime("Fecha/hora inválida"),
  notes: z.string().max(1000).optional().default(""),
  assignments: z
    .array(AssignmentSchema)
    .min(1, "Selecciona al menos un servicio"),
});

export const UpdateAppointmentScheduleSchema = z.object({
  appointment_id: z.string().uuid("ID de cita inválido"),
  start_time: z.string().datetime("Fecha/hora inválida"),
  notes: z.string().max(1000).optional().default(""),
  assignments: z
    .array(AssignmentSchema)
    .min(1, "Selecciona al menos un servicio"),
});

export const CompleteAppointmentSchema = z.object({
  appointment_id: z.string().uuid("ID de cita inválido"),
  payment_method: PaymentMethodSchema,
  completion_price_note: z.string().max(500).optional().default(""),
  item_charges: z
    .array(
      z.object({
        id: z.string().uuid("ID de servicio inválido"),
        price: z.number().min(0, "El precio no puede ser negativo"),
        discountPercentage: z
          .number()
          .min(0, "El descuento no puede ser negativo")
          .max(100, "El descuento no puede ser mayor a 100%")
          .optional()
          .default(0),
      })
    )
    .min(1, "La cita debe tener al menos un servicio"),
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentScheduleInput = z.infer<typeof UpdateAppointmentScheduleSchema>;
