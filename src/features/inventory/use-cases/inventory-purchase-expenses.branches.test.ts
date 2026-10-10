import { beforeEach, describe, expect, it, vi } from "vitest";
import type { findInventoryPurchaseHistory } from "../data/inventory.repo";
import {
  getInventoryPurchaseExpenseHistory,
  type InventoryPurchaseExpenseDeps,
} from "./inventory-purchase-expenses";

// Fake tipado de la lectura: el caso de uso recibe la dependencia por parámetro.
const mockedFindHistory = vi.fn<InventoryPurchaseExpenseDeps["findPurchaseHistory"]>();
const deps: InventoryPurchaseExpenseDeps = { findPurchaseHistory: mockedFindHistory };

function purchase(overrides: Record<string, unknown> = {}) {
  return {
    id: "buy-1",
    purchase_date: "2026-06-10",
    total_cost: "45.5",
    supplier_name: "Distribuidora",
    note: null,
    created_at: "2026-06-10T09:00:00.000Z",
    inventory_purchase_items: [],
    ...overrides,
  };
}

describe("getInventoryPurchaseExpenseHistory (ramas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("describe la compra con los nombres de sus productos, en forma de objeto o arreglo", async () => {
    mockedFindHistory.mockResolvedValue([
      purchase({
        inventory_purchase_items: [
          { quantity: 1, unit_cost: 1, total_cost: 1, product: { name: "Tinte" } },
          { quantity: 1, unit_cost: 1, total_cost: 1, product: [{ name: "Oxidante" }] },
          { quantity: 1, unit_cost: 1, total_cost: 1, product: null },
          { quantity: 1, unit_cost: 1, total_cost: 1, product: [] },
        ],
      }) as Awaited<ReturnType<typeof findInventoryPurchaseHistory>>[number],
    ]);

    const [entry] = await getInventoryPurchaseExpenseHistory("salon-1", deps);

    expect(entry).toEqual({
      id: "buy-1",
      date: "2026-06-10",
      amount: 45.5,
      commerceName: "Distribuidora",
      note: null,
      createdAt: "2026-06-10T09:00:00.000Z",
      detail: "Tinte, Oxidante",
    });
  });

  it("usa la nota como detalle cuando no hay productos identificables", async () => {
    mockedFindHistory.mockResolvedValue([
      purchase({ note: "Reposicion mensual", inventory_purchase_items: [{ product: null }] }) as Awaited<
        ReturnType<typeof findInventoryPurchaseHistory>
      >[number],
    ]);

    const [entry] = await getInventoryPurchaseExpenseHistory("salon-1", deps);

    expect(entry?.detail).toBe("Reposicion mensual");
  });

  it("usa un detalle generico cuando no hay productos ni nota, y importe cero sin total", async () => {
    mockedFindHistory.mockResolvedValue([
      purchase({ total_cost: null, supplier_name: null, inventory_purchase_items: null }) as Awaited<
        ReturnType<typeof findInventoryPurchaseHistory>
      >[number],
    ]);

    const [entry] = await getInventoryPurchaseExpenseHistory("salon-1", deps);

    expect(entry).toMatchObject({ amount: 0, commerceName: null, detail: "Compra de productos" });
  });

  it("devuelve lista vacia cuando el salón no tiene compras", async () => {
    mockedFindHistory.mockResolvedValue([]);

    expect(await getInventoryPurchaseExpenseHistory("salon-1", deps)).toEqual([]);
    expect(mockedFindHistory).toHaveBeenCalledWith("salon-1");
  });
});
