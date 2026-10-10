import { z } from "@/infra/validation/zod";
import { isValidOptionalPhone, phoneValidationMessage } from "@/infra/format/phone";
import { normalizePaymentMethod } from "@/features/payments";

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

const IdempotencyKeySchema = z.string().uuid("La clave de idempotencia debe ser un uuid.");

/** Cliente nuevo de la propia cita: se da de alta en la misma transaccion que la cita (ADR de citas). */
const NewCustomerSchema = z.object({
  first_name: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  last_name: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .refine(isValidOptionalPhone, phoneValidationMessage()),
});

const CLIENT_CHOICE_MESSAGE = "Indica un cliente existente o un cliente nuevo, no ambos ni ninguno.";

// Exactamente uno: un cliente existente (customer_id) o un cliente nuevo (new_customer).
export const CreateAppointmentSchema = z
  .object({
    customer_id: z.string().uuid("ID de cliente inválido").optional(),
    new_customer: NewCustomerSchema.optional(),
    start_time: z.string().datetime("Fecha/hora inválida"),
    notes: z.string().max(1000).optional().default(""),
    assignments: z
      .array(AssignmentSchema)
      .min(1, "Selecciona al menos un servicio"),
    idempotency_key: IdempotencyKeySchema,
  })
  .refine((value) => (value.customer_id !== undefined) !== (value.new_customer !== undefined), {
    message: CLIENT_CHOICE_MESSAGE,
    path: ["customer_id"],
  });

export const UpdateAppointmentScheduleSchema = z.object({
  appointment_id: z.string().uuid("ID de cita inválido"),
  start_time: z.string().datetime("Fecha/hora inválida"),
  notes: z.string().max(1000).optional().default(""),
  assignments: z
    .array(AssignmentSchema)
    .min(1, "Selecciona al menos un servicio"),
  idempotency_key: IdempotencyKeySchema,
});

/** Cancelar o confirmar: FormData con el id de la cita y la clave de idempotencia. */
export const AppointmentLifecycleSchema = z.object({
  appointment_id: z.string().uuid("ID de cita inválido"),
  idempotency_key: IdempotencyKeySchema,
});

export const CompleteAppointmentSchema = z.object({
  appointment_id: z.string().uuid("ID de cita inválido"),
  idempotency_key: IdempotencyKeySchema,
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
export type CompleteAppointmentInput = z.infer<typeof CompleteAppointmentSchema>;
