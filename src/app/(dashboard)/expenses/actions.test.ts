import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/infra/auth/permissions";
import { requireActiveProfile } from "@/infra/auth/session";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import { createExpense, createInventoryPurchaseExpense } from "@/features/expenses/use-cases/expenses";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import { createExpenseAction, createInventoryPurchaseExpenseAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/infra/auth/session", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
}));
vi.mock("@/features/expenses/use-cases/expenses", () => ({
  createExpense: vi.fn(),
  createInventoryPurchaseExpense: vi.fn(),
}));

const expensesManager = buildProfile({ permissions: [PERMISSIONS.EXPENSES_MANAGE] });
const fullManager = buildProfile({
  permissions: [PERMISSIONS.EXPENSES_MANAGE, PERMISSIONS.INVENTORY_MANAGE],
});
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000c1";
const validExpense = {
  expense_date: "2026-10-01",
  amount: "120.5",
  category: "rent",
  vendor_name: "Casero",
  idempotency_key: IDEMPOTENCY_KEY,
};
const validPurchase = {
  purchase_date: "2026-10-01",
  product_id: RECORD_ID,
  quantity: "2",
  unit_cost: "10",
  commerce_name: "Proveedor X",
  idempotency_key: IDEMPOTENCY_KEY,
};

describe("expenses actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(fullManager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  describe("createExpenseAction", () => {
    it("rechaza a un perfil sin permiso de gastos", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await createExpenseAction(null, formDataOf(validExpense))).toEqual({
        ok: false,
        error: "No tienes permiso para gestionar gastos.",
      });
      expect(createExpense).not.toHaveBeenCalled();
    });

    it("propaga el rechazo de rate limit, módulo y límite del plan", async () => {
      vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));
      expect(await createExpenseAction(null, formDataOf(validExpense))).toEqual({
        ok: false,
        error: "Demasiados intentos.",
      });

      vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
      vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));
      expect(await createExpenseAction(null, formDataOf(validExpense))).toEqual({
        ok: false,
        error: "Módulo no incluido en tu plan.",
      });

      vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
      vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de gastos alcanzado."));
      expect(await createExpenseAction(null, formDataOf(validExpense))).toEqual({
        ok: false,
        error: "Límite de gastos alcanzado.",
      });
      expect(createExpense).not.toHaveBeenCalled();
    });

    it("devuelve el primer issue de Zod cuando falta la fecha", async () => {
      const result = await createExpenseAction(null, formDataOf({ ...validExpense, expense_date: "" }));

      expect(result).toEqual({ ok: false, error: "La fecha es obligatoria." });
      expect(createExpense).not.toHaveBeenCalled();
    });

    it("rechaza un monto que no es positivo", async () => {
      const result = await createExpenseAction(null, formDataOf({ ...validExpense, amount: "0" }));

      expect(result).toEqual({ ok: false, error: "El monto debe ser mayor que 0." });
      expect(createExpense).not.toHaveBeenCalled();
    });

    it("registra el gasto convertido a número y revalida las vistas afectadas", async () => {
      vi.mocked(createExpense).mockResolvedValue(ok("exp-1"));

      const result = await createExpenseAction(null, formDataOf(validExpense));

      expect(result).toEqual({ ok: true, value: "exp-1" });
      expect(createExpense).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ amount: 120.5, category: "rent", vendor_name: "Casero" }),
        IDEMPOTENCY_KEY
      );
      for (const path of ["/", "/expenses", "/inventory", "/reports", "/retail"]) {
        expect(revalidatePath).toHaveBeenCalledWith(path);
      }
    });

    it("no revalida si el caso de uso falla", async () => {
      vi.mocked(createExpense).mockResolvedValue(err("Error de base de datos."));

      expect(await createExpenseAction(null, formDataOf(validExpense))).toEqual({
        ok: false,
        error: "Error de base de datos.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("createInventoryPurchaseExpenseAction", () => {
    it("exige además permiso de inventario para registrar compras", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(expensesManager);

      expect(await createInventoryPurchaseExpenseAction(null, formDataOf(validPurchase))).toEqual({
        ok: false,
        error: "No tienes permiso para registrar compras de inventario.",
      });
      expect(createInventoryPurchaseExpense).not.toHaveBeenCalled();
    });

    it("rechaza a un perfil sin permiso de gastos", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect((await createInventoryPurchaseExpenseAction(null, formDataOf(validPurchase))).ok).toBe(false);
      expect(createInventoryPurchaseExpense).not.toHaveBeenCalled();
    });

    it("devuelve el primer issue de Zod cuando falta la fecha de compra", async () => {
      const result = await createInventoryPurchaseExpenseAction(
        null,
        formDataOf({ ...validPurchase, purchase_date: "" })
      );

      expect(result).toEqual({ ok: false, error: "La fecha es obligatoria." });
      expect(createInventoryPurchaseExpense).not.toHaveBeenCalled();
    });

    it("usa commerce_name como proveedor cuando no llega supplier_name y fija la ubicación en storage", async () => {
      vi.mocked(createInventoryPurchaseExpense).mockResolvedValue(ok("exp-2"));

      const result = await createInventoryPurchaseExpenseAction(null, formDataOf(validPurchase));

      expect(result).toEqual({ ok: true, value: "exp-2" });
      expect(createInventoryPurchaseExpense).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ supplier_name: "Proveedor X", location: "storage", quantity: 2 }),
        IDEMPOTENCY_KEY
      );
      expect(revalidatePath).toHaveBeenCalledWith("/inventory");
    });

    it("prefiere supplier_name sobre commerce_name", async () => {
      vi.mocked(createInventoryPurchaseExpense).mockResolvedValue(ok("exp-3"));

      await createInventoryPurchaseExpenseAction(
        null,
        formDataOf({ ...validPurchase, supplier_name: "Distribuidora Sol" })
      );

      expect(createInventoryPurchaseExpense).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ supplier_name: "Distribuidora Sol" }),
        IDEMPOTENCY_KEY
      );
    });

    it("exige una clave de idempotencia uuid antes de registrar la compra", async () => {
      const result = await createInventoryPurchaseExpenseAction(
        null,
        formDataOf({ ...validPurchase, idempotency_key: "" })
      );

      expect(result).toEqual({ ok: false, error: "La clave de idempotencia debe ser un uuid." });
      expect(createInventoryPurchaseExpense).not.toHaveBeenCalled();
    });

    it("propaga el límite de movimientos del plan sin persistir", async () => {
      vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de movimientos alcanzado."));

      expect(await createInventoryPurchaseExpenseAction(null, formDataOf(validPurchase))).toEqual({
        ok: false,
        error: "Límite de movimientos alcanzado.",
      });
      expect(createInventoryPurchaseExpense).not.toHaveBeenCalled();
    });
  });
});
