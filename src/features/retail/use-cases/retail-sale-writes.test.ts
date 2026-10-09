import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { assertSalonPaymentMethodEnabled } from "@/features/salon";
import { err, ok } from "@/infra/result";
import { createRetailSale } from "./retail-sales";
import { createRetailSaleWithPlanLimits } from "./retail-sale-writes";

vi.mock("@/features/billing", () => ({
  checkPlanModuleAccess: vi.fn(),
  checkPlanLimit: vi.fn(),
}));
vi.mock("@/features/salon", () => ({
  assertSalonPaymentMethodEnabled: vi.fn(),
}));
vi.mock("./retail-sales", () => ({
  createRetailSale: vi.fn(),
}));

const SALON = "salon-1";
const KEY = "00000000-0000-4000-8000-0000000000c1";
const sale = {
  product_id: "00000000-0000-4000-8000-0000000000bb",
  quantity: 2,
  unit_price: 150,
  payment_method: "card",
  idempotency_key: KEY,
} as Parameters<typeof createRetailSale>[1];

describe("createRetailSaleWithPlanLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(assertSalonPaymentMethodEnabled).mockResolvedValue(true);
  });

  it("consulta el módulo vitrina y el cupo de ventas antes de registrar", async () => {
    vi.mocked(createRetailSale).mockResolvedValue(ok("sale-1"));

    expect(await createRetailSaleWithPlanLimits(SALON, sale, KEY)).toEqual(ok("sale-1"));
    expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON, moduleKey: "retail" });
    expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON, metricKey: "retail.sales" });
    expect(createRetailSale).toHaveBeenCalledWith(SALON, sale, KEY);
  });

  it("devuelve el rechazo del módulo o del cupo sin registrar", async () => {
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));
    expect(await createRetailSaleWithPlanLimits(SALON, sale, KEY)).toEqual({
      ok: false,
      error: "Módulo no incluido en tu plan.",
    });

    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de ventas alcanzado."));
    expect(await createRetailSaleWithPlanLimits(SALON, sale, KEY)).toEqual({
      ok: false,
      error: "Límite de ventas alcanzado.",
    });
    expect(createRetailSale).not.toHaveBeenCalled();
  });

  it("rechaza un método de pago no habilitado por el salón sin registrar", async () => {
    vi.mocked(assertSalonPaymentMethodEnabled).mockResolvedValue(false);

    expect(await createRetailSaleWithPlanLimits(SALON, sale, KEY)).toEqual({
      ok: false,
      error: "Ese metodo de pago no esta habilitado para este salon.",
    });
    expect(assertSalonPaymentMethodEnabled).toHaveBeenCalledWith(SALON, "card");
    expect(createRetailSale).not.toHaveBeenCalled();
  });
});
