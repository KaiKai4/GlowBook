import { captureError } from "@/infra/observability";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findInventoryProducts,
  findRecentInventoryMovements,
  softDeleteInventoryProduct,
  type InventoryMovementRow,
  type InventoryProductRow,
} from "../data/inventory.repo";
import {
  createInventoryProductWithStockRpc,
  updateInventoryProductProfileRpc,
} from "../data/rpc/inventory-product-rpc";
import type { CreateInventoryProductInput, UpdateInventoryProductInput } from "../schemas";
import {
  createInventoryProduct,
  deleteInventoryProduct,
  getInventoryPage,
  updateInventoryProductProfile,
} from "./inventory-products";

vi.mock("../data/inventory.repo", () => ({
  findInventoryProducts: vi.fn(),
  findRecentInventoryMovements: vi.fn(),
  softDeleteInventoryProduct: vi.fn(),
}));

vi.mock("../data/rpc/inventory-product-rpc", () => ({
  createInventoryProductWithStockRpc: vi.fn(),
  updateInventoryProductProfileRpc: vi.fn(),
}));

const mockedFindProducts = vi.mocked(findInventoryProducts);
const mockedFindMovements = vi.mocked(findRecentInventoryMovements);
const mockedCreateRpc = vi.mocked(createInventoryProductWithStockRpc);
const mockedUpdateRpc = vi.mocked(updateInventoryProductProfileRpc);
const mockedSoftDelete = vi.mocked(softDeleteInventoryProduct);

type InventoryStockRow = NonNullable<InventoryProductRow["inventory_stock_locations"]>[number];

const SALON_ID = "salon-1";
const PRODUCT_ID = "product-1";

function productRow(overrides: Partial<InventoryProductRow>): InventoryProductRow {
  return {
    id: "p",
    salon_id: SALON_ID,
    name: "Producto",
    category: null,
    cost_price: 0,
    sale_price: 0,
    is_retail_enabled: false,
    is_active: true,
    inventory_stock_locations: [],
    ...overrides,
  };
}

function stockRow(
  productId: string,
  location: InventoryStockRow["location"],
  quantity: number | string,
  minimumQuantity: number | string
): InventoryStockRow {
  return {
    id: `${productId}-${location}`,
    salon_id: SALON_ID,
    product_id: productId,
    location,
    quantity,
    minimum_quantity: minimumQuantity,
  };
}

function movementRow(overrides: Partial<InventoryMovementRow>): InventoryMovementRow {
  return {
    id: "m",
    salon_id: SALON_ID,
    product_id: PRODUCT_ID,
    location: "retail",
    movement_type: "sale",
    quantity_delta: 0,
    quantity_after: 0,
    note: null,
    created_at: "2026-06-12T10:00:00.000Z",
    ...overrides,
  };
}

function createInput(overrides: Partial<CreateInventoryProductInput> = {}): CreateInventoryProductInput {
  return {
    name: "Tinte",
    category: "Color",
    cost_price: 4,
    sale_price: 9,
    is_retail_enabled: true,
    retail_quantity: 2,
    internal_quantity: 0,
    storage_quantity: 5,
    retail_minimum: 1,
    internal_minimum: 0,
    storage_minimum: 3,
    ...overrides,
  };
}

function updateInput(overrides: Partial<UpdateInventoryProductInput> = {}): UpdateInventoryProductInput {
  return {
    name: "Tinte",
    category: "Color",
    cost_price: 4,
    sale_price: 9,
    is_retail_enabled: true,
    is_active: true,
    retail_minimum: 1,
    internal_minimum: 2,
    storage_minimum: 3,
    ...overrides,
  };
}

describe("inventory-products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getInventoryPage", () => {
    it("calcula estado y total de stock por ubicación y marca los productos con stock bajo", async () => {
      mockedFindProducts.mockResolvedValue([
        productRow({
          id: "p-ok",
          name: "Shampoo",
          category: "Cuidado",
          cost_price: "3.5",
          sale_price: "8",
          is_retail_enabled: true,
          inventory_stock_locations: [
            stockRow("p-ok", "retail", 10, 2),
            stockRow("p-ok", "storage", "4", "4"),
          ],
        }),
        productRow({ id: "p-vacio", name: "Tinte", cost_price: 1, sale_price: 0 }),
      ]);
      mockedFindMovements.mockResolvedValue([]);

      const view = await getInventoryPage(SALON_ID);

      const [shampoo, tinte] = view.products;
      expect(shampoo).toMatchObject({
        id: "p-ok",
        category: "Cuidado",
        costPrice: 3.5,
        salePrice: 8,
        isRetailEnabled: true,
        totalQuantity: 14,
      });
      expect(shampoo?.stock).toEqual([
        { location: "retail", label: "Vitrina", quantity: 10, minimumQuantity: 2, status: "ok" },
        { location: "internal", label: "Uso interno", quantity: 0, minimumQuantity: 0, status: "empty" },
        { location: "storage", label: "Bodega", quantity: 4, minimumQuantity: 4, status: "low" },
      ]);
      expect(tinte).toMatchObject({ category: "", salePrice: 0, isRetailEnabled: false, totalQuantity: 0 });
      expect(tinte?.stock.every((stock) => stock.status === "empty")).toBe(true);
      expect(view.lowStock.map((product) => product.id)).toEqual(["p-ok", "p-vacio"]);
    });

    it("no incluye en stock bajo productos con todas sus ubicaciones suficientes", async () => {
      mockedFindProducts.mockResolvedValue([
        productRow({
          id: "p1",
          name: "Gel",
          category: "Unas",
          cost_price: 1,
          sale_price: 2,
          inventory_stock_locations: [
            stockRow("p1", "retail", 5, 1),
            stockRow("p1", "internal", 1, 0),
            stockRow("p1", "storage", 9, 3),
          ],
        }),
      ]);
      mockedFindMovements.mockResolvedValue([]);

      const view = await getInventoryPage(SALON_ID);

      expect(view.products[0]?.stock.map((stock) => stock.status)).toEqual(["ok", "ok", "ok"]);
      expect(view.lowStock).toEqual([]);
    });

    it("resuelve el nombre del producto de movimientos en forma de objeto, arreglo o ausente", async () => {
      mockedFindProducts.mockResolvedValue([]);
      mockedFindMovements.mockResolvedValue([
        movementRow({ id: "m1", product: { name: "Objeto" }, quantity_delta: -1, quantity_after: 4 }),
        movementRow({
          id: "m2",
          product: [{ name: "Arreglo" }],
          location: "storage",
          movement_type: "purchase",
          quantity_delta: 5,
          quantity_after: 9,
          note: "lote",
        }),
        movementRow({ id: "m3", product: null, location: "internal", movement_type: "adjust" }),
        movementRow({ id: "m4", product: [], location: "internal", movement_type: "adjust", quantity_delta: 1, quantity_after: 1 }),
      ]);

      const view = await getInventoryPage(SALON_ID);

      expect(view.recentMovements.map((movement) => [movement.id, movement.productName])).toEqual([
        ["m1", "Objeto"],
        ["m2", "Arreglo"],
        ["m3", "Producto"],
        ["m4", "Producto"],
      ]);
      expect(view.recentMovements[1]).toMatchObject({ note: "lote", movementType: "purchase" });
      expect(view.recentMovements[2]).toMatchObject({ note: "", quantityDelta: 0, quantityAfter: 0 });
    });

    it("consulta productos y movimientos del salón indicado", async () => {
      mockedFindProducts.mockResolvedValue([]);
      mockedFindMovements.mockResolvedValue([]);

      await getInventoryPage(SALON_ID);

      expect(mockedFindProducts).toHaveBeenCalledWith(SALON_ID);
      expect(mockedFindMovements).toHaveBeenCalledWith(SALON_ID);
    });
  });

  describe("createInventoryProduct", () => {
    it("envia el producto con sus cantidades y minimos por ubicacion a la RPC del salon", async () => {
      mockedCreateRpc.mockResolvedValue(PRODUCT_ID);

      expect(await createInventoryProduct(SALON_ID, createInput())).toEqual({ ok: true, value: undefined });

      expect(mockedCreateRpc).toHaveBeenCalledTimes(1);
      expect(mockedCreateRpc).toHaveBeenCalledWith({
        salonId: SALON_ID,
        name: "Tinte",
        category: "Color",
        costPrice: 4,
        salePrice: 9,
        isRetailEnabled: true,
        retailQuantity: 2,
        retailMinimum: 1,
        internalQuantity: 0,
        internalMinimum: 0,
        storageQuantity: 5,
        storageMinimum: 3,
      });
    });

    it("envia categoria nula cuando viene vacia", async () => {
      mockedCreateRpc.mockResolvedValue(PRODUCT_ID);

      await createInventoryProduct(SALON_ID, createInput({ category: "" }));

      expect(mockedCreateRpc).toHaveBeenCalledWith(expect.objectContaining({ category: null }));
    });

    it("informa nombre duplicado cuando el error de BD es una violación de unicidad (SQLSTATE 23505)", async () => {
      mockedCreateRpc.mockRejectedValue(Object.assign(new Error("duplicate key value"), { code: "23505" }));

      expect(await createInventoryProduct(SALON_ID, createInput())).toEqual({
        ok: false,
        error: "Ya existe un producto con ese nombre.",
      });
    });

    it("no deduce duplicado por el texto del mensaje si el SQLSTATE no es 23505", async () => {
      mockedCreateRpc.mockRejectedValue(new Error("duplicate unique constraint"));

      expect(await createInventoryProduct(SALON_ID, createInput())).toEqual({
        ok: false,
        error: "Error al crear el producto.",
      });
    });

    it("devuelve error generico para otros fallos, incluido un error que no es Error", async () => {
      mockedCreateRpc.mockRejectedValue(new Error("caida"));
      expect(await createInventoryProduct(SALON_ID, createInput())).toEqual({
        ok: false,
        error: "Error al crear el producto.",
      });

      mockedCreateRpc.mockRejectedValue("texto");
      expect(await createInventoryProduct(SALON_ID, createInput())).toEqual({
        ok: false,
        error: "Error al crear el producto.",
      });
    });
  });

  describe("updateInventoryProductProfile", () => {
    it("envia el producto y los minimos de cada ubicacion en una sola llamada a la RPC", async () => {
      mockedUpdateRpc.mockResolvedValue(undefined);

      expect(await updateInventoryProductProfile(PRODUCT_ID, SALON_ID, updateInput())).toEqual({
        ok: true,
        value: undefined,
      });

      expect(mockedUpdateRpc).toHaveBeenCalledTimes(1);
      expect(mockedUpdateRpc).toHaveBeenCalledWith({
        salonId: SALON_ID,
        productId: PRODUCT_ID,
        name: "Tinte",
        category: "Color",
        costPrice: 4,
        salePrice: 9,
        isRetailEnabled: true,
        isActive: true,
        retailMinimum: 1,
        internalMinimum: 2,
        storageMinimum: 3,
      });
    });

    it("devuelve error generico si la RPC falla y registra el error", async () => {
      mockedUpdateRpc.mockRejectedValue(new Error("caida"));

      expect(await updateInventoryProductProfile(PRODUCT_ID, SALON_ID, updateInput())).toEqual({
        ok: false,
        error: "Error al actualizar el producto.",
      });
      expect(captureError).toHaveBeenCalledWith(expect.any(Error), {
        module: "inventory",
        action: "update_product",
      });
    });
  });

  describe("deleteInventoryProduct", () => {
    it("aplica borrado logico del producto del salón", async () => {
      expect(await deleteInventoryProduct(PRODUCT_ID, SALON_ID)).toEqual({ ok: true, value: undefined });
      expect(mockedSoftDelete).toHaveBeenCalledWith(PRODUCT_ID, SALON_ID);
    });

    it("devuelve error generico si el borrado logico falla", async () => {
      mockedSoftDelete.mockRejectedValue(new Error("caida"));

      expect(await deleteInventoryProduct(PRODUCT_ID, SALON_ID)).toEqual({
        ok: false,
        error: "Error al eliminar el producto.",
      });
    });
  });
});

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

describe("registro de errores de eliminación", () => {
  it("registra con captureError el fallo al eliminar el producto", async () => {
    const dbError = new Error("caida");
    mockedSoftDelete.mockRejectedValue(dbError);

    expect(await deleteInventoryProduct("prod-1", "salon-1")).toEqual({ ok: false, error: "Error al eliminar el producto." });
    expect(captureError).toHaveBeenCalledWith(dbError, { module: "inventory", action: "delete_product" });
  });
});
