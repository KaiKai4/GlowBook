import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { err, ok } from "@/infra/result";
import { createExpense, createInventoryPurchaseExpense } from "./expenses";
import { createExpenseWithPlanLimits, createInventoryPurchaseWithPlanLimits } from "./expense-writes";

vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
}));
vi.mock("./expenses", () => ({
  createExpense: vi.fn(),
  createInventoryPurchaseExpense: vi.fn(),
}));

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

describe("createExpenseWithPlanLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  it("consulta el módulo gastos y el cupo total antes de registrar", async () => {
    vi.mocked(createExpense).mockResolvedValue(ok("exp-1"));

    expect(await createExpenseWithPlanLimits(SALON, expenseInput, KEY)).toEqual(ok("exp-1"));
    expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON, moduleKey: "expenses" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON, metricKey: "expenses.total" });
    expect(createExpense).toHaveBeenCalledWith(SALON, expenseInput, KEY);
  });

  it("devuelve el rechazo del módulo sin registrar", async () => {
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));

    expect(await createExpenseWithPlanLimits(SALON, expenseInput, KEY)).toEqual({
      ok: false,
      error: "Módulo no incluido en tu plan.",
    });
    expect(createExpense).not.toHaveBeenCalled();
  });

  it("devuelve el rechazo del cupo sin registrar", async () => {
    vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de gastos alcanzado."));

    expect(await createExpenseWithPlanLimits(SALON, expenseInput, KEY)).toEqual({
      ok: false,
      error: "Límite de gastos alcanzado.",
    });
    expect(createExpense).not.toHaveBeenCalled();
  });
});

describe("createInventoryPurchaseWithPlanLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  it("consulta el módulo inventario y el cupo de movimientos antes de registrar la compra", async () => {
    vi.mocked(createInventoryPurchaseExpense).mockResolvedValue(ok("exp-2"));

    expect(await createInventoryPurchaseWithPlanLimits(SALON, purchaseInput, KEY)).toEqual(ok("exp-2"));
    expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON, moduleKey: "inventory" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON, metricKey: "inventory.movements" });
    expect(createInventoryPurchaseExpense).toHaveBeenCalledWith(SALON, purchaseInput, KEY);
  });

  it("devuelve el rechazo del módulo o del cupo sin registrar", async () => {
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));
    expect(await createInventoryPurchaseWithPlanLimits(SALON, purchaseInput, KEY)).toEqual({
      ok: false,
      error: "Módulo no incluido en tu plan.",
    });

    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de movimientos alcanzado."));
    expect(await createInventoryPurchaseWithPlanLimits(SALON, purchaseInput, KEY)).toEqual({
      ok: false,
      error: "Límite de movimientos alcanzado.",
    });
    expect(createInventoryPurchaseExpense).not.toHaveBeenCalled();
  });
});
