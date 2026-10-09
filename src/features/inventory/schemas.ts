import { z } from "@/lib/validation/zod";
import { INVENTORY_LOCATIONS } from "./domain/stock";

const money = z.coerce.number().min(0);
const quantity = z.coerce.number().min(0);
const positiveQuantity = z.coerce.number().positive("La cantidad debe ser mayor que 0.");

export const InventoryLocationSchema = z.enum(INVENTORY_LOCATIONS);

export const CreateInventoryProductSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  category: z.string().trim().max(80).optional().default(""),
  cost_price: money.default(0),
  sale_price: money.default(0),
  is_retail_enabled: z.boolean().default(true),
  retail_quantity: quantity.default(0),
  internal_quantity: quantity.default(0),
  storage_quantity: quantity.default(0),
  retail_minimum: quantity.default(0),
  internal_minimum: quantity.default(0),
  storage_minimum: quantity.default(0),
});

export const UpdateInventoryProductSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  category: z.string().trim().max(80).optional().default(""),
  cost_price: money.default(0),
  sale_price: money.default(0),
  is_retail_enabled: z.boolean().default(true),
  is_active: z.coerce.boolean().default(true),
  retail_minimum: quantity.default(0),
  internal_minimum: quantity.default(0),
  storage_minimum: quantity.default(0),
});

export const InventoryTransferSchema = z.object({
  product_id: z.string().uuid("Producto inválido."),
  from_location: InventoryLocationSchema,
  to_location: InventoryLocationSchema,
  quantity: positiveQuantity,
  note: z.string().trim().max(500).optional().default(""),
}).refine((value) => value.from_location !== value.to_location, {
  path: ["to_location"],
  message: "El destino debe ser diferente al origen.",
});

export const InventoryPurchaseSchema = z.object({
  supplier_name: z.string().trim().max(120).optional().default(""),
  purchase_date: z.string().trim().min(1, "La fecha es obligatoria."),
  product_id: z.string().uuid("Producto inválido."),
  location: InventoryLocationSchema,
  quantity: positiveQuantity,
  unit_cost: money.default(0),
  note: z.string().trim().max(500).optional().default(""),
});

export type CreateInventoryProductInput = z.infer<typeof CreateInventoryProductSchema>;
export type UpdateInventoryProductInput = z.infer<typeof UpdateInventoryProductSchema>;
export type InventoryTransferInput = z.infer<typeof InventoryTransferSchema>;
export type InventoryPurchaseInput = z.infer<typeof InventoryPurchaseSchema>;
