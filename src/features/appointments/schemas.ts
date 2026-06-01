import { z } from "zod";

export const AssignmentSchema = z.object({
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
  appointment_id: z.string().uuid("ID de cita invÃ¡lido"),
  start_time: z.string().datetime("Fecha/hora invÃ¡lida"),
  notes: z.string().max(1000).optional().default(""),
  assignments: z
    .array(AssignmentSchema)
    .min(1, "Selecciona al menos un servicio"),
});

export const UpdateAppointmentStatusSchema = z.object({
  appointment_id: z.string().uuid(),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]),
  payment_method: z
    .enum(["", "cash", "card", "transfer", "yappy", "other"])
    .optional(),
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentScheduleInput = z.infer<typeof UpdateAppointmentScheduleSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof UpdateAppointmentStatusSchema>;
