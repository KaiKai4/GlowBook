import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import {
  createInventoryProduct,
  deleteInventoryProduct,
  getInventoryPage,
  updateInventoryProductProfile,
  type InventoryProductView,
} from "@/features/inventory/use-cases/inventory-products";
import { transferInventoryStock } from "@/features/inventory/use-cases/inventory-movements";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import {
  createInventoryProductAction,
  deleteInventoryProductAction,
  transferInventoryStockAction,
  updateInventoryProductAction,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
  const requireActiveProfile = vi.fn();
  return {
    requireActiveProfile,
    requireActionContext: vi.fn(async () => contextFromProfile(await requireActiveProfile())),
  };
});
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
}));
vi.mock("@/features/inventory/use-cases/inventory-products", () => ({
  createInventoryProduct: vi.fn(),
  deleteInventoryProduct: vi.fn(),
  getInventoryPage: vi.fn(),
  updateInventoryProductProfile: vi.fn(),
}));
vi.mock("@/features/inventory/use-cases/inventory-movements", () => ({
  transferInventoryStock: vi.fn(),
}));

const inventoryManager = buildProfile({ permissions: [PERMISSIONS.INVENTORY_MANAGE] });
const permissionError = "No tienes permiso para gestionar inventario.";

function product(overrides: Partial<InventoryProductView>): InventoryProductView {
  return {
    id: RECORD_ID,
    name: "Shampoo",
    category: "",
    costPrice: 10,
    salePrice: 15,
    isRetailEnabled: true,
    isActive: true,
    totalQuantity: 5,
    stock: [],
    ...overrides,
  };
}

function inventoryPage(products: InventoryProductView[]) {
  return { products, lowStock: [], recentMovements: [] };
}

describe("inventory actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(inventoryManager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  it("todas las mutaciones rechazan sin permiso de inventario o si se excede el límite", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());
    expect(await deleteInventoryProductAction(RECORD_ID)).toEqual({ ok: false, error: permissionError });

    vi.mocked(requireActiveProfile).mockResolvedValue(inventoryManager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));
    expect(await deleteInventoryProductAction(RECORD_ID)).toEqual({ ok: false, error: "Demasiados intentos." });
    expect(deleteInventoryProduct).not.toHaveBeenCalled();
  });

  describe("createInventoryProductAction", () => {
    it("propaga el rechazo del módulo y del límite de productos", async () => {
      vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));
      expect(await createInventoryProductAction(null, formDataOf({ name: "Shampoo" }))).toEqual({
        ok: false,
        error: "Módulo no incluido en tu plan.",
      });

      vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
      vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de productos alcanzado."));
      expect(await createInventoryProductAction(null, formDataOf({ name: "Shampoo" }))).toEqual({
        ok: false,
        error: "Límite de productos alcanzado.",
      });
      expect(createInventoryProduct).not.toHaveBeenCalled();
    });

    it("devuelve el primer issue de Zod cuando el nombre está vacío", async () => {
      expect(await createInventoryProductAction(null, formDataOf({ name: "   " }))).toEqual({
        ok: false,
        error: "El nombre es obligatorio.",
      });
      expect(createInventoryProduct).not.toHaveBeenCalled();
    });

    it("crea el producto con el flag de venta al público y revalida inventario, vitrina y reportes", async () => {
      vi.mocked(createInventoryProduct).mockResolvedValue(ok(undefined));

      const result = await createInventoryProductAction(
        null,
        formDataOf({ name: "Shampoo", cost_price: "10", sale_price: "15", is_retail_enabled: "true" })
      );

      expect(result).toEqual({ ok: true, value: "Producto creado." });
      expect(createInventoryProduct).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ name: "Shampoo", cost_price: 10, sale_price: 15, is_retail_enabled: true })
      );
      for (const path of ["/inventory", "/retail", "/reports"]) {
        expect(revalidatePath).toHaveBeenCalledWith(path);
      }
    });

    it("devuelve el error del caso de uso sin revalidar", async () => {
      vi.mocked(createInventoryProduct).mockResolvedValue(err("SKU duplicado."));

      expect(await createInventoryProductAction(null, formDataOf({ name: "Shampoo" }))).toEqual({
        ok: false,
        error: "SKU duplicado.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("updateInventoryProductAction", () => {
    it("devuelve el primer issue de Zod cuando el nombre está vacío", async () => {
      expect(
        await updateInventoryProductAction(RECORD_ID, null, formDataOf({ name: "" }))
      ).toEqual({ ok: false, error: "El nombre es obligatorio." });
      expect(updateInventoryProductProfile).not.toHaveBeenCalled();
    });

    it("actualiza el producto y revalida solo si tiene éxito", async () => {
      vi.mocked(updateInventoryProductProfile).mockResolvedValue(ok(undefined));

      const result = await updateInventoryProductAction(
        RECORD_ID,
        null,
        formDataOf({
          name: "Shampoo",
          category: "Cabello",
          cost_price: "10",
          sale_price: "15",
          is_retail_enabled: "true",
          is_active: "false",
          retail_minimum: "1",
          internal_minimum: "0",
          storage_minimum: "2",
        })
      );

      expect(result).toEqual({ ok: true, value: undefined });
      expect(updateInventoryProductProfile).toHaveBeenCalledWith(
        RECORD_ID,
        SALON_ID,
        expect.objectContaining({ name: "Shampoo", category: "Cabello", is_active: false, storage_minimum: 2 })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/inventory");

      vi.clearAllMocks();
      vi.mocked(requireActiveProfile).mockResolvedValue(inventoryManager);
      vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
      vi.mocked(updateInventoryProductProfile).mockResolvedValue(err("Producto no encontrado."));
      const completeForm = formDataOf({
        name: "Shampoo",
        category: "",
        cost_price: "10",
        sale_price: "15",
        retail_minimum: "0",
        internal_minimum: "0",
        storage_minimum: "0",
      });
      expect(await updateInventoryProductAction(RECORD_ID, null, completeForm)).toEqual({
        ok: false,
        error: "Producto no encontrado.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("normaliza los campos ausentes de FormData y conserva los defaults del schema", async () => {
      vi.mocked(updateInventoryProductProfile).mockResolvedValue(ok(undefined));

      const result = await updateInventoryProductAction(RECORD_ID, null, formDataOf({ name: "Shampoo" }));

      expect(result).toEqual({ ok: true, value: undefined });
      expect(updateInventoryProductProfile).toHaveBeenCalledWith(
        RECORD_ID,
        SALON_ID,
        expect.objectContaining({ name: "Shampoo", category: "", cost_price: 0, sale_price: 0, retail_minimum: 0 })
      );
    });
  });

  describe("transferInventoryStockAction", () => {
    const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000c1";
    const transferForm = (overrides: Record<string, string>) =>
      formDataOf({
        product_id: RECORD_ID,
        to_location: "internal",
        quantity: "2",
        idempotency_key: IDEMPOTENCY_KEY,
        ...overrides,
      });

    it("exige una clave de idempotencia uuid antes de transferir", async () => {
      expect(await transferInventoryStockAction(null, transferForm({ idempotency_key: "" }))).toEqual({
        ok: false,
        error: "La clave de idempotencia debe ser un uuid.",
      });
      expect(transferInventoryStock).not.toHaveBeenCalled();
    });

    it("rechaza un identificador de producto inválido", async () => {
      expect(await transferInventoryStockAction(null, transferForm({ product_id: "bad" }))).toEqual({
        ok: false,
        error: "Producto inválido.",
      });
      expect(transferInventoryStock).not.toHaveBeenCalled();
    });

    it("rechaza transferir a la misma ubicación de origen (bodega)", async () => {
      expect(await transferInventoryStockAction(null, transferForm({ to_location: "storage" }))).toEqual({
        ok: false,
        error: "El destino debe ser diferente al origen.",
      });
      expect(transferInventoryStock).not.toHaveBeenCalled();
    });

    it("rechaza un producto que no pertenece al inventario del salón", async () => {
      vi.mocked(getInventoryPage).mockResolvedValue(inventoryPage([]));

      expect(await transferInventoryStockAction(null, transferForm({}))).toEqual({
        ok: false,
        error: "Producto inválido.",
      });
      expect(getInventoryPage).toHaveBeenCalledWith(SALON_ID);
      expect(transferInventoryStock).not.toHaveBeenCalled();
    });

    it("solo permite a Uso interno un producto que no está habilitado para vitrina", async () => {
      vi.mocked(getInventoryPage).mockResolvedValue(
        inventoryPage([product({ isRetailEnabled: false })])
      );

      expect(await transferInventoryStockAction(null, transferForm({ to_location: "retail" }))).toEqual({
        ok: false,
        error: "Este producto solo puede transferirse de Bodega a Uso interno.",
      });
      expect(transferInventoryStock).not.toHaveBeenCalled();
    });

    it("registra la transferencia válida y revalida inventario, vitrina y reportes", async () => {
      vi.mocked(getInventoryPage).mockResolvedValue(inventoryPage([product({ isRetailEnabled: false })]));
      vi.mocked(transferInventoryStock).mockResolvedValue(ok(undefined));

      const result = await transferInventoryStockAction(null, transferForm({ to_location: "internal" }));

      expect(result).toEqual({ ok: true, value: "Transferencia registrada." });
      expect(transferInventoryStock).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ product_id: RECORD_ID, from_location: "storage", to_location: "internal", quantity: 2 }),
        IDEMPOTENCY_KEY
      );
      expect(revalidatePath).toHaveBeenCalledWith("/inventory");
      expect(revalidatePath).toHaveBeenCalledWith("/retail");
    });
  });

  describe("deleteInventoryProductAction", () => {
    it("elimina el producto, devuelve el mensaje y revalida", async () => {
      vi.mocked(deleteInventoryProduct).mockResolvedValue(ok(undefined));

      expect(await deleteInventoryProductAction(RECORD_ID)).toEqual({
        ok: true,
        value: "Producto eliminado.",
      });
      expect(deleteInventoryProduct).toHaveBeenCalledWith(RECORD_ID, SALON_ID);
      expect(revalidatePath).toHaveBeenCalledWith("/reports");
    });

    it("devuelve el error sin revalidar si el producto tiene movimientos", async () => {
      vi.mocked(deleteInventoryProduct).mockResolvedValue(err("El producto tiene movimientos."));

      expect(await deleteInventoryProductAction(RECORD_ID)).toEqual({
        ok: false,
        error: "El producto tiene movimientos.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
