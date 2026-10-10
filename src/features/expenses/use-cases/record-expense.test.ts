import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/infra/result";
import type { createExpense, createInventoryPurchaseExpense } from "./expenses";
import {
  createExpenseWithPlanLimits,
  createInventoryPurchaseWithPlanLimits,
  type CreateExpenseWithPlanLimitsDeps,
  type CreateInventoryPurchaseWithPlanLimitsDeps,
} from "./record-expense";

const SALON = "salon-1";
const KEY = "00000000-0000-4000-8000-0000000000c1";

const expenseInput = {
  expense_date: "2026-10-01",
  amount: 120.5,
  category: "rent",
  vendor_name: "Casero",
  idempotency_key: KEY,
} as Parameters<typeof createExpense>[1];

const purchaseInput = {
  purchase_date: "2026-10-01",
  product_id: "00000000-0000-4000-8000-0000000000bb",
  quantity: 2,
  unit_cost: 10,
  supplier_name: "Proveedor X",
  location: "storage",
  idempotency_key: KEY,
} as Parameters<typeof createInventoryPurchaseExpense>[1];

const checkModuleAccess = vi.fn<CreateExpenseWithPlanLimitsDeps["checkModuleAccess"]>();
const checkLimit = vi.fn<CreateExpenseWithPlanLimitsDeps["checkLimit"]>();
const expenseCreate = vi.fn<CreateExpenseWithPlanLimitsDeps["createExpense"]>();
const expenseDeps: CreateExpenseWithPlanLimitsDeps = {
  checkModuleAccess,
  checkLimit,
  createExpense: expenseCreate,
};

const purchaseCheckModuleAccess = vi.fn<CreateInventoryPurchaseWithPlanLimitsDeps["checkModuleAccess"]>();
const purchaseCheckLimit = vi.fn<CreateInventoryPurchaseWithPlanLimitsDeps["checkLimit"]>();
const createPurchaseExpense = vi.fn<CreateInventoryPurchaseWithPlanLimitsDeps["createPurchaseExpense"]>();
const purchaseDeps: CreateInventoryPurchaseWithPlanLimitsDeps = {
  checkModuleAccess: purchaseCheckModuleAccess,
  checkLimit: purchaseCheckLimit,
  createPurchaseExpense,
};

describe("createExpenseWithPlanLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkModuleAccess.mockResolvedValue(ok(undefined));
    checkLimit.mockResolvedValue(ok(undefined));
  });

  it("consulta el módulo gastos y el cupo total antes de registrar", async () => {
    expenseCreate.mockResolvedValue(ok("exp-1"));

    expect(await createExpenseWithPlanLimits(SALON, expenseInput, KEY, expenseDeps)).toEqual(ok("exp-1"));
    expect(checkModuleAccess).toHaveBeenCalledWith({ salonId: SALON, moduleKey: "expenses" });
    expect(checkLimit).toHaveBeenCalledWith({ salonId: SALON, metricKey: "expenses.total" });
    expect(expenseCreate).toHaveBeenCalledWith(SALON, expenseInput, KEY);
  });

  it("devuelve el rechazo del módulo sin registrar", async () => {
    checkModuleAccess.mockResolvedValue(err("Módulo no incluido en tu plan."));

    expect(await createExpenseWithPlanLimits(SALON, expenseInput, KEY, expenseDeps)).toEqual({
      ok: false,
      error: "Módulo no incluido en tu plan.",
    });
    expect(expenseCreate).not.toHaveBeenCalled();
  });

  it("devuelve el rechazo del cupo sin registrar", async () => {
    checkLimit.mockResolvedValue(err("Límite de gastos alcanzado."));

    expect(await createExpenseWithPlanLimits(SALON, expenseInput, KEY, expenseDeps)).toEqual({
      ok: false,
      error: "Límite de gastos alcanzado.",
    });
    expect(expenseCreate).not.toHaveBeenCalled();
  });
});

describe("createInventoryPurchaseWithPlanLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purchaseCheckModuleAccess.mockResolvedValue(ok(undefined));
    purchaseCheckLimit.mockResolvedValue(ok(undefined));
  });

  it("consulta el módulo inventario y el cupo de movimientos antes de registrar la compra", async () => {
    createPurchaseExpense.mockResolvedValue(ok("exp-2"));

    expect(await createInventoryPurchaseWithPlanLimits(SALON, purchaseInput, KEY, purchaseDeps)).toEqual(ok("exp-2"));
    expect(purchaseCheckModuleAccess).toHaveBeenCalledWith({ salonId: SALON, moduleKey: "inventory" });
    expect(purchaseCheckLimit).toHaveBeenCalledWith({ salonId: SALON, metricKey: "inventory.movements" });
    expect(createPurchaseExpense).toHaveBeenCalledWith(SALON, purchaseInput, KEY);
  });

  it("devuelve el rechazo del módulo o del cupo sin registrar", async () => {
    purchaseCheckModuleAccess.mockResolvedValue(err("Módulo no incluido en tu plan."));
    expect(await createInventoryPurchaseWithPlanLimits(SALON, purchaseInput, KEY, purchaseDeps)).toEqual({
      ok: false,
      error: "Módulo no incluido en tu plan.",
    });

    purchaseCheckModuleAccess.mockResolvedValue(ok(undefined));
    purchaseCheckLimit.mockResolvedValue(err("Límite de movimientos alcanzado."));
    expect(await createInventoryPurchaseWithPlanLimits(SALON, purchaseInput, KEY, purchaseDeps)).toEqual({
      ok: false,
      error: "Límite de movimientos alcanzado.",
    });
    expect(createPurchaseExpense).not.toHaveBeenCalled();
  });
});
