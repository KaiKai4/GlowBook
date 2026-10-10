import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { err, ok } from "@/infra/result";
import type { InventoryPageView, InventoryProductView } from "./inventory-products";
import { transferInventoryStock } from "./inventory-movements";
import { createInventoryProduct, getInventoryPage } from "./inventory-products";
import {
  createInventoryProductWithPlanLimits,
  transferInventoryStockWithPlanLimits,
} from "./inventory-product-writes";

vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
}));
vi.mock("./inventory-products", () => ({
  createInventoryProduct: vi.fn(),
  getInventoryPage: vi.fn(),
}));
vi.mock("./inventory-movements", () => ({
  transferInventoryStock: vi.fn(),
}));

const SALON = "salon-1";
const KEY = "00000000-0000-4000-8000-0000000000c1";
const PRODUCT_ID = "00000000-0000-4000-8000-0000000000bb";

const createInput = {
  name: "Shampoo",
  category: "",
  cost_price: 10,
  sale_price: 15,
  is_retail_enabled: true,
} as Parameters<typeof createInventoryProduct>[1];

const transferInput = {
  product_id: PRODUCT_ID,
  from_location: "storage",
  to_location: "retail",
  quantity: 2,
  idempotency_key: KEY,
} as Parameters<typeof transferInventoryStock>[1];

function pageWith(products: InventoryProductView[]): InventoryPageView {
  return { products, lowStock: [], recentMovements: [] };
}

function product(isRetailEnabled: boolean): InventoryProductView {
  return {
    id: PRODUCT_ID,
    name: "Shampoo",
    category: "",
    costPrice: 10,
    salePrice: 15,
    isRetailEnabled,
    isActive: true,
    totalQuantity: 5,
    stock: [],
  };
}

describe("createInventoryProductWithPlanLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  it("consulta el módulo inventario y el cupo de productos antes de crear", async () => {
    vi.mocked(createInventoryProduct).mockResolvedValue(ok(undefined));

    expect(await createInventoryProductWithPlanLimits(SALON, createInput)).toEqual(ok(undefined));
    expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON, moduleKey: "inventory" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON, metricKey: "inventory.products" });
    expect(createInventoryProduct).toHaveBeenCalledWith(SALON, createInput);
  });

  it("devuelve el rechazo del módulo sin crear", async () => {
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));

    expect(await createInventoryProductWithPlanLimits(SALON, createInput)).toEqual({
      ok: false,
      error: "Módulo no incluido en tu plan.",
    });
    expect(checkPlanLimit).not.toHaveBeenCalled();
    expect(createInventoryProduct).not.toHaveBeenCalled();
  });

  it("devuelve el rechazo del cupo sin crear", async () => {
    vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de productos alcanzado."));

    expect(await createInventoryProductWithPlanLimits(SALON, createInput)).toEqual({
      ok: false,
      error: "Límite de productos alcanzado.",
    });
    expect(createInventoryProduct).not.toHaveBeenCalled();
  });
});

describe("transferInventoryStockWithPlanLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  it("devuelve el rechazo del módulo o del cupo de movimientos sin transferir", async () => {
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));
    expect(await transferInventoryStockWithPlanLimits(SALON, transferInput)).toEqual({
      ok: false,
      error: "Módulo no incluido en tu plan.",
    });

    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de movimientos alcanzado."));
    expect(await transferInventoryStockWithPlanLimits(SALON, transferInput)).toEqual({
      ok: false,
      error: "Límite de movimientos alcanzado.",
    });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON, metricKey: "inventory.movements" });
    expect(transferInventoryStock).not.toHaveBeenCalled();
  });

  it("rechaza un producto que no pertenece al inventario del salón", async () => {
    vi.mocked(getInventoryPage).mockResolvedValue(pageWith([]));

    expect(await transferInventoryStockWithPlanLimits(SALON, transferInput)).toEqual({
      ok: false,
      error: "Producto inválido.",
    });
    expect(getInventoryPage).toHaveBeenCalledWith(SALON);
    expect(transferInventoryStock).not.toHaveBeenCalled();
  });

  it("bloquea a vitrina un producto que no está habilitado para vitrina", async () => {
    vi.mocked(getInventoryPage).mockResolvedValue(pageWith([product(false)]));

    expect(await transferInventoryStockWithPlanLimits(SALON, transferInput)).toEqual({
      ok: false,
      error: "Este producto solo puede transferirse de Bodega a Uso interno.",
    });
    expect(transferInventoryStock).not.toHaveBeenCalled();
  });

  it("transfiere con la clave de idempotencia cuando la regla lo permite", async () => {
    vi.mocked(getInventoryPage).mockResolvedValue(pageWith([product(true)]));
    vi.mocked(transferInventoryStock).mockResolvedValue(ok(undefined));

    expect(await transferInventoryStockWithPlanLimits(SALON, transferInput)).toEqual(ok(undefined));
    expect(transferInventoryStock).toHaveBeenCalledWith(SALON, transferInput, KEY);
  });

  it("devuelve el error del caso de uso de transferencia", async () => {
    vi.mocked(getInventoryPage).mockResolvedValue(pageWith([product(true)]));
    vi.mocked(transferInventoryStock).mockResolvedValue(err("Stock insuficiente."));

    expect(await transferInventoryStockWithPlanLimits(SALON, transferInput)).toEqual({
      ok: false,
      error: "Stock insuficiente.",
    });
  });
});
