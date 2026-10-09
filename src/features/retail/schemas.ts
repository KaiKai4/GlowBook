import { z } from "@/lib/validation/zod";
import { InventoryLocationSchema } from "@/features/inventory/schemas";
import { normalizePaymentMethod } from "@/features/payments/domain/payment-methods";

const PaymentMethodSchema = z
  .string()
  .trim()
  .min(1, "El metodo de pago es obligatorio.")
  .max(64, "El metodo de pago no puede superar 64 caracteres.")
  .transform(normalizePaymentMethod);

export const RetailSaleSchema = z.object({
  customer_id: z.string().uuid().optional().or(z.literal("")).default(""),
  product_id: z.string().uuid("Producto inválido."),
  location: InventoryLocationSchema.default("retail"),
  quantity: z.coerce
    .number()
    .int("La cantidad debe ser un numero entero.")
    .positive("La cantidad debe ser mayor que 0."),
  unit_price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  payment_method: PaymentMethodSchema.default("cash"),
  note: z.string().trim().max(500).optional().default(""),
  idempotency_key: z.string().uuid("La clave de idempotencia debe ser un uuid."),
});

export type RetailSaleInput = z.infer<typeof RetailSaleSchema>;
