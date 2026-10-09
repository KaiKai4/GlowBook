import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import { createRetailSale } from "@/features/retail/use-cases/retail-sales";
import { assertSalonPaymentMethodEnabled } from "@/features/salon/use-cases/salon-payment-methods";
import { err, ok } from "@/lib/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import { createRetailSaleAction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
}));
vi.mock("@/features/retail/use-cases/retail-sales", () => ({ createRetailSale: vi.fn() }));
vi.mock("@/features/salon/use-cases/salon-payment-methods", () => ({
  assertSalonPaymentMethodEnabled: vi.fn(),
}));

const retailManager = buildProfile({ permissions: [PERMISSIONS.RETAIL_MANAGE] });
const validSale = {
  product_id: RECORD_ID,
  quantity: "2",
  unit_price: "150",
  payment_method: "card",
};

describe("createRetailSaleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(retailManager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(assertSalonPaymentMethodEnabled).mockResolvedValue(true);
  });

  it("rechaza a un perfil sin permiso de vitrina", async () => {
    vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

    expect(await createRetailSaleAction(null, formDataOf(validSale))).toEqual({
      ok: false,
      error: "No tienes permiso para gestionar vitrina.",
    });
    expect(createRetailSale).not.toHaveBeenCalled();
  });

  it("propaga el rechazo de rate limit, módulo y límite del plan", async () => {
    vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));
    expect(await createRetailSaleAction(null, formDataOf(validSale))).toEqual({
      ok: false,
      error: "Demasiados intentos.",
    });

    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));
    expect(await createRetailSaleAction(null, formDataOf(validSale))).toEqual({
      ok: false,
      error: "Módulo no incluido en tu plan.",
    });

    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de ventas alcanzado."));
    expect(await createRetailSaleAction(null, formDataOf(validSale))).toEqual({
      ok: false,
      error: "Límite de ventas alcanzado.",
    });
    expect(createRetailSale).not.toHaveBeenCalled();
  });

  it("devuelve el primer issue de Zod cuando el producto no es un identificador válido", async () => {
    const result = await createRetailSaleAction(null, formDataOf({ ...validSale, product_id: "no-uuid" }));

    expect(result).toEqual({ ok: false, error: "Producto inválido." });
    expect(createRetailSale).not.toHaveBeenCalled();
  });

  it("rechaza un método de pago que el salón no tiene habilitado", async () => {
    vi.mocked(assertSalonPaymentMethodEnabled).mockResolvedValue(false);

    const result = await createRetailSaleAction(null, formDataOf(validSale));

    expect(result).toEqual({
      ok: false,
      error: "Ese metodo de pago no esta habilitado para este salon.",
    });
    expect(assertSalonPaymentMethodEnabled).toHaveBeenCalledWith(SALON_ID, "card");
    expect(createRetailSale).not.toHaveBeenCalled();
  });

  it("registra la venta con cantidad numérica y revalida vitrina, inventario y reportes", async () => {
    vi.mocked(createRetailSale).mockResolvedValue(ok("sale-1"));

    const result = await createRetailSaleAction(null, formDataOf(validSale));

    expect(result).toEqual({ ok: true, value: "sale-1" });
    expect(createRetailSale).toHaveBeenCalledWith(
      SALON_ID,
      expect.objectContaining({ product_id: RECORD_ID, quantity: 2, payment_method: "card" })
    );
    for (const path of ["/retail", "/inventory", "/reports"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("no revalida si la venta falla", async () => {
    vi.mocked(createRetailSale).mockResolvedValue(err("Stock insuficiente."));

    expect(await createRetailSaleAction(null, formDataOf(validSale))).toEqual({
      ok: false,
      error: "Stock insuficiente.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
