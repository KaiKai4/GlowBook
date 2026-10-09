import { describe, expect, it } from "vitest";
import {
  CreateInventoryProductSchema,
  InventoryPurchaseSchema,
  InventoryTransferSchema,
  UpdateInventoryProductSchema,
} from "./schemas";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000033";

describe("inventory schemas", () => {
  describe("CreateInventoryProductSchema", () => {
    it("aplica valores por defecto a precios, cantidades y minimos", () => {
      expect(CreateInventoryProductSchema.parse({ name: "  Tinte  " })).toEqual({
        name: "Tinte",
        category: "",
        cost_price: 0,
        sale_price: 0,
        is_retail_enabled: true,
        retail_quantity: 0,
        internal_quantity: 0,
        storage_quantity: 0,
        retail_minimum: 0,
        internal_minimum: 0,
        storage_minimum: 0,
      });
    });

    it("convierte cadenas numericas de formularios a numeros", () => {
      const parsed = CreateInventoryProductSchema.parse({
        name: "Tinte",
        cost_price: "4.5",
        sale_price: "9",
        retail_quantity: "2",
      });

      expect(parsed).toMatchObject({ cost_price: 4.5, sale_price: 9, retail_quantity: 2 });
    });

    it("exige nombre no vacio y no negativos en precios y cantidades", () => {
      const empty = CreateInventoryProductSchema.safeParse({ name: "   " });
      expect(empty.error?.issues[0]?.message).toBe("El nombre es obligatorio.");

      expect(CreateInventoryProductSchema.safeParse({ name: "T", cost_price: -1 }).success).toBe(false);
      expect(CreateInventoryProductSchema.safeParse({ name: "T", storage_quantity: -2 }).success).toBe(false);
    });
  });

  describe("UpdateInventoryProductSchema", () => {
    it("interpreta el estado activo textual y mantiene el valor por defecto true", () => {
      expect(UpdateInventoryProductSchema.parse({ name: "T" }).is_active).toBe(true);
      expect(UpdateInventoryProductSchema.parse({ name: "T", is_active: "" }).is_active).toBe(false);
    });
  });

  describe("InventoryTransferSchema", () => {
    const base = { product_id: PRODUCT_ID, from_location: "storage", to_location: "retail", quantity: "2" };

    it("acepta una transferencia entre ubicaciones distintas con cantidad positiva", () => {
      expect(InventoryTransferSchema.parse(base)).toEqual({ ...base, quantity: 2, note: "" });
    });

    it("rechaza transferir a la misma ubicacion de origen", () => {
      const result = InventoryTransferSchema.safeParse({ ...base, to_location: "storage" });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["to_location"]);
      expect(result.error?.issues[0]?.message).toBe("El destino debe ser diferente al origen.");
    });

    it("exige cantidad positiva y producto con formato uuid", () => {
      expect(InventoryTransferSchema.safeParse({ ...base, quantity: 0 }).error?.issues[0]?.message).toBe(
        "La cantidad debe ser mayor que 0."
      );
      expect(InventoryTransferSchema.safeParse({ ...base, product_id: "x" }).error?.issues[0]?.message).toBe(
        "Producto inválido."
      );
      expect(InventoryTransferSchema.safeParse({ ...base, from_location: "bodega" }).success).toBe(false);
    });
  });

  describe("InventoryPurchaseSchema", () => {
    const base = {
      purchase_date: "2026-06-10",
      product_id: PRODUCT_ID,
      location: "storage",
      quantity: "3",
    };

    it("aplica defaults de proveedor, costo unitario y nota", () => {
      expect(InventoryPurchaseSchema.parse(base)).toEqual({
        ...base,
        supplier_name: "",
        quantity: 3,
        unit_cost: 0,
        note: "",
      });
    });

    it("exige fecha y cantidad positiva", () => {
      expect(InventoryPurchaseSchema.safeParse({ ...base, purchase_date: " " }).error?.issues[0]?.message).toBe(
        "La fecha es obligatoria."
      );
      expect(InventoryPurchaseSchema.safeParse({ ...base, quantity: "-1" }).success).toBe(false);
    });
  });
});
