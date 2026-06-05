import { z } from "zod";
import {
  normalizePaymentMethod,
  normalizePaymentMethods,
} from "@/features/payments/domain/payment-methods";

export const SALON_THEMES = ["violet", "mocco", "tiffany", "viridian", "yellow", "rosewater"] as const;
export type SalonTheme = (typeof SALON_THEMES)[number];

export const SALON_BG_STYLES = ["neutral", "colored"] as const;
export type SalonBgStyle = (typeof SALON_BG_STYLES)[number];

export const SalonInfoSchema = z.object({
  name: z.string().min(1, "El nombre del salón es obligatorio").max(120),
});

export type SalonInfoInput = z.infer<typeof SalonInfoSchema>;

export const SalonPaymentMethodsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "El metodo de pago es obligatorio.")
      .max(64, "El metodo de pago no puede superar 64 caracteres.")
      .transform(normalizePaymentMethod)
  )
  .min(1, "Agrega al menos un metodo de pago.")
  .transform((values) => normalizePaymentMethods(values));

export type SalonPaymentMethodsInput = z.infer<typeof SalonPaymentMethodsSchema>;

const TimeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (usa formato HH:MM)");

export const BusinessDaySchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    open_time: TimeString.nullable(),
    close_time: TimeString.nullable(),
  })
  .refine(
    (d) =>
      !d.is_open ||
      (!!d.open_time && !!d.close_time && d.open_time < d.close_time),
    {
      message: "La hora de cierre debe ser mayor que la de apertura.",
      path: ["close_time"],
    }
  );

// Exactly 7 entries, one per weekday (0 = Monday … 6 = Sunday).
export const BusinessHoursSchema = z.array(BusinessDaySchema).length(7);

export type BusinessDayInput = z.infer<typeof BusinessDaySchema>;
