import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { createRetailSale } from "@/features/retail/use-cases/retail-sales";
import { assertSalonPaymentMethodEnabled } from "@/features/salon/use-cases/salon-payment-methods";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import { createRetailSaleAction } from "./actions";

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
vi.mock("@/features/retail/use-cases/retail-sales", () => ({ createRetailSale: vi.fn() }));
vi.mock("@/features/salon/use-cases/salon-payment-methods", () => ({
  assertSalonPaymentMethodEnabled: vi.fn(),
}));

const retailManager = buildProfile({ permissions: [PERMISSIONS.RETAIL_MANAGE] });
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000c1";
const validSale = {
  product_id: RECORD_ID,
  quantity: "2",
  unit_price: "150",
  payment_method: "card",
  idempotency_key: IDEMPOTENCY_KEY,
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
      error: "Ese método de pago no está habilitado para este salón.",
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
      expect.objectContaining({ product_id: RECORD_ID, quantity: 2, payment_method: "card" }),
      IDEMPOTENCY_KEY
    );
    for (const path of ["/retail", "/inventory", "/reports"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("exige una clave de idempotencia uuid antes de registrar la venta", async () => {
    const withoutKey = await createRetailSaleAction(null, formDataOf({ ...validSale, idempotency_key: "" }));

    expect(withoutKey).toEqual({ ok: false, error: "La clave de idempotencia debe ser un uuid." });
    expect(createRetailSale).not.toHaveBeenCalled();
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
