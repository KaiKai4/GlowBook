"use server";

import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import {
  CreateInventoryProductSchema,
  InventoryTransferSchema,
  UpdateInventoryProductSchema,
  type CreateInventoryProductInput,
  type InventoryTransferInput,
  type UpdateInventoryProductInput,
} from "@/features/inventory/schemas";
import { deleteInventoryProduct, updateInventoryProductProfile } from "@/features/inventory";
import {
  createInventoryProductWithPlanLimits,
  transferInventoryStockWithPlanLimits,
} from "@/features/inventory";
import { err, ok, type Result } from "@/infra/result";
import { parseUuid } from "@/infra/validation/route-id";

// Vistas que dependen del inventario: vitrina y reportes incluidos.
const INVENTORY_PATHS = ["/inventory", "/retail", "/reports"] as const;

const createProductFlow = defineAction<FormData, CreateInventoryProductInput, string>({
  permission: { key: PERMISSIONS.INVENTORY_MANAGE, deniedMessage: "No tienes permiso para gestionar inventario." },
  rateLimit: { scope: "inventory", options: RATE_LIMIT_POLICIES.write },
  parse: (formData) =>
    parseWithSchema(CreateInventoryProductSchema)({
      ...Object.fromEntries(formData),
      is_retail_enabled: formData.get("is_retail_enabled") === "true",
    }),
  run: async (input, session) => {
    const result = await createInventoryProductWithPlanLimits(session.salonId, input);
    return result.ok ? ok("Producto creado.") : result;
  },
  revalidate: () => INVENTORY_PATHS,
});

interface UpdateProductRaw {
  productId: string;
  formData: FormData;
}

interface UpdateProductInput {
  productId: string;
  data: UpdateInventoryProductInput;
}

const updateProductFlow = defineAction<UpdateProductRaw, UpdateProductInput, void>({
  permission: { key: PERMISSIONS.INVENTORY_MANAGE, deniedMessage: "No tienes permiso para gestionar inventario." },
  rateLimit: { scope: "inventory", options: RATE_LIMIT_POLICIES.write },
  parse: ({ productId, formData }) => {
    if (!parseUuid(productId)) return err("Identificador inválido.");

    // Un campo ausente en FormData llega como null; se pasa como undefined para que
    // Zod aplique los defaults del schema en lugar de rechazar el null.
    const field = (key: string) => formData.get(key) ?? undefined;
    const parsed = parseWithSchema(UpdateInventoryProductSchema)({
      name: field("name"),
      category: field("category"),
      cost_price: field("cost_price"),
      sale_price: field("sale_price"),
      is_retail_enabled: formData.get("is_retail_enabled") === "true",
      is_active: formData.get("is_active") === "true",
      retail_minimum: field("retail_minimum"),
      internal_minimum: field("internal_minimum"),
      storage_minimum: field("storage_minimum"),
    });
    return parsed.ok ? ok({ productId, data: parsed.value }) : parsed;
  },
  run: (input, session) => updateInventoryProductProfile(input.productId, session.salonId, input.data),
  revalidate: () => INVENTORY_PATHS,
});

const transferStockFlow = defineAction<FormData, InventoryTransferInput, string>({
  permission: { key: PERMISSIONS.INVENTORY_MANAGE, deniedMessage: "No tienes permiso para gestionar inventario." },
  rateLimit: { scope: "inventory", options: RATE_LIMIT_POLICIES.write },
  parse: (formData) => parseWithSchema(InventoryTransferSchema)(Object.fromEntries(formData)),
  run: async (input, session) => {
    const result = await transferInventoryStockWithPlanLimits(session.salonId, input);
    return result.ok ? ok("Transferencia registrada.") : result;
  },
  revalidate: () => INVENTORY_PATHS,
});

const deleteProductFlow = defineAction<string, string, string>({
  permission: { key: PERMISSIONS.INVENTORY_MANAGE, deniedMessage: "No tienes permiso para gestionar inventario." },
  rateLimit: { scope: "inventory", options: RATE_LIMIT_POLICIES.write },
  parse: (productId) => (parseUuid(productId) ? ok(productId) : err("Identificador inválido.")),
  run: async (productId, session) => {
    const result = await deleteInventoryProduct(productId, session.salonId);
    return result.ok ? ok("Producto eliminado.") : result;
  },
  revalidate: () => INVENTORY_PATHS,
});

export async function createInventoryProductAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return createProductFlow(formData);
}

export async function updateInventoryProductAction(
  productId: string,
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return updateProductFlow({ productId, formData });
}

export async function transferInventoryStockAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return transferStockFlow(formData);
}

export async function deleteInventoryProductAction(productId: string): Promise<Result<string>> {
  return deleteProductFlow(productId);
}
