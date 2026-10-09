import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import { PublicError } from "@/lib/public-error";
import { insertExpense } from "./expenses/data/expenses.repo";
import { createExpense } from "./expenses/use-cases/expenses";
import { recordInventoryPurchaseRpc } from "./inventory/data/rpc/record-inventory-purchase";
import { recordInventoryTransferRpc } from "./inventory/data/rpc/record-inventory-transfer";
import {
  recordInventoryPurchase,
  transferInventoryStock,
} from "./inventory/use-cases/inventory-movements";
import { recordRetailSaleRpc } from "./retail/data/rpc/record-retail-sale";
import { createRetailSale } from "./retail/use-cases/retail-sales";

vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./expenses/data/expenses.repo", () => ({ insertExpense: vi.fn() }));
vi.mock("./inventory/data/rpc/record-inventory-purchase", () => ({
  recordInventoryPurchaseRpc: vi.fn(),
}));
vi.mock("./inventory/data/rpc/record-inventory-transfer", () => ({
  recordInventoryTransferRpc: vi.fn(),
}));
vi.mock("./retail/data/retail.repo", () => ({
  findRecentRetailSales: vi.fn(),
}));
vi.mock("./retail/data/rpc/record-retail-sale", () => ({
  recordRetailSaleRpc: vi.fn(),
}));
vi.mock("@/features/inventory/use-cases/inventory-purchase-expenses", () => ({
  getInventoryPurchaseExpenseHistory: vi.fn(),
}));
vi.mock("@/features/customers/use-cases/customer-options", () => ({
  getCustomerOptions: vi.fn(),
}));
vi.mock("@/features/inventory/use-cases/retail-inventory-products", () => ({
  getRetailInventoryProducts: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/salon-payment-methods", () => ({
  getSalonPaymentMethods: vi.fn(),
}));

const SALON = "00000000-0000-4000-8000-000000000001";
const KEY = "00000000-0000-4000-8000-0000000000c1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gastos: mensaje publico al registrar", () => {
  it("un RAISE de negocio de la base se muestra tal cual", async () => {
    vi.mocked(insertExpense).mockRejectedValue(
      Object.assign(new Error("El gasto supera el presupuesto del mes."), { code: "P0001" })
    );

    const result = await createExpense(SALON, {} as never, KEY);

    expect(result).toEqual({ ok: false, error: "El gasto supera el presupuesto del mes." });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("un fallo interno usa el mensaje de respaldo y registra el error", async () => {
    const failure = new Error("socket hang up");
    vi.mocked(insertExpense).mockRejectedValue(failure);

    const result = await createExpense(SALON, {} as never, KEY);

    expect(result).toEqual({ ok: false, error: "No se pudo registrar el gasto." });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "errors", action: "public-message" });
  });

  it("registra el gasto y devuelve su mensaje de exito", async () => {
    vi.mocked(insertExpense).mockResolvedValue(undefined as never);

    const result = await createExpense(SALON, {} as never, KEY);

    expect(result).toEqual({ ok: true, value: "Gasto registrado." });
  });
});

describe("inventario: transferencias y reposiciones", () => {
  it("transferir stock sin stock suficiente muestra el motivo de dominio", async () => {
    vi.mocked(recordInventoryTransferRpc).mockRejectedValue(
      new PublicError("No hay stock suficiente en el origen.")
    );

    const result = await transferInventoryStock(SALON, {} as never, KEY);

    expect(result).toEqual({ ok: false, error: "No hay stock suficiente en el origen." });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("transferir stock con un fallo interno usa el mensaje de respaldo", async () => {
    vi.mocked(recordInventoryTransferRpc).mockRejectedValue(new Error("deadlock detected"));

    const result = await transferInventoryStock(SALON, {} as never, KEY);

    expect(result).toEqual({ ok: false, error: "Error al transferir stock." });
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("transferir stock correctamente devuelve ok", async () => {
    vi.mocked(recordInventoryTransferRpc).mockResolvedValue(undefined as never);

    expect(await transferInventoryStock(SALON, {} as never, KEY)).toEqual({ ok: true, value: undefined });
  });

  it("registrar una reposicion con un producto inexistente se traduce por SQLSTATE 23503", async () => {
    vi.mocked(recordInventoryPurchaseRpc).mockRejectedValue(
      Object.assign(new Error("fk"), { code: "23503" })
    );

    const result = await recordInventoryPurchase(SALON, {
      supplier_name: "Proveedor",
      purchase_date: "2026-06-01",
      product_id: "p",
      quantity: 1,
      unit_cost: 1,
      note: "",
    } as never, KEY);

    expect(result).toEqual({
      ok: false,
      error: "La operación hace referencia a un registro inexistente.",
    });
  });

  it("registrar una reposicion con un fallo interno usa el mensaje de respaldo", async () => {
    vi.mocked(recordInventoryPurchaseRpc).mockRejectedValue(new Error("boom"));

    const result = await recordInventoryPurchase(SALON, {} as never, KEY);

    expect(result).toEqual({ ok: false, error: "Error al registrar la reposicion." });
  });
});

describe("venta de productos: mensaje publico", () => {
  it("una venta que no pasa una regla de negocio de la base muestra su mensaje", async () => {
    vi.mocked(recordRetailSaleRpc).mockRejectedValue(
      Object.assign(new Error("Stock insuficiente para la venta."), { code: "P0001" })
    );

    const result = await createRetailSale(SALON, {
      product_id: "p",
      location: "store",
      quantity: 1,
      unit_price: 10,
      payment_method: "cash",
      note: "",
    } as never, KEY);

    expect(result).toEqual({ ok: false, error: "Stock insuficiente para la venta." });
  });

  it("una venta con fallo interno usa el mensaje de respaldo y registra el error", async () => {
    const failure = new Error("connection lost");
    vi.mocked(recordRetailSaleRpc).mockRejectedValue(failure);

    const result = await createRetailSale(SALON, {} as never, KEY);

    expect(result).toEqual({ ok: false, error: "No se pudo registrar la venta." });
    expect(captureError).toHaveBeenCalledWith(failure, { module: "errors", action: "public-message" });
  });
});
