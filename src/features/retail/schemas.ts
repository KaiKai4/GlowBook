import { z } from "zod";
import { InventoryLocationSchema } from "@/features/inventory/schemas";

export const RetailSaleSchema = z.object({
  customer_id: z.string().uuid().optional().or(z.literal("")).default(""),
  product_id: z.string().uuid("Producto inválido."),
  location: InventoryLocationSchema.default("retail"),
  quantity: z.coerce
    .number()
    .int("La cantidad debe ser un numero entero.")
    .positive("La cantidad debe ser mayor que 0."),
  unit_price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  payment_method: z.enum(["cash", "card", "transfer", "yappy", "other"]).default("cash"),
  note: z.string().trim().max(500).optional().default(""),
});

export type RetailSaleInput = z.infer<typeof RetailSaleSchema>;
