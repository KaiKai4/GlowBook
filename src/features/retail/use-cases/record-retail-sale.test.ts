import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok, err } from "@/infra/result";
import type { createRetailSale } from "./retail-sales";
import {
  createRetailSaleWithPlanLimits,
  type CreateRetailSaleWithPlanLimitsDeps,
} from "./record-retail-sale";

const SALON = "salon-1";
const KEY = "00000000-0000-4000-8000-0000000000c1";
const sale = {
  product_id: "00000000-0000-4000-8000-0000000000bb",
  quantity: 2,
  unit_price: 150,
  payment_method: "card",
  idempotency_key: KEY,
} as Parameters<typeof createRetailSale>[1];

const checkModuleAccess = vi.fn<CreateRetailSaleWithPlanLimitsDeps["checkModuleAccess"]>();
const checkLimit = vi.fn<CreateRetailSaleWithPlanLimitsDeps["checkLimit"]>();
const isPaymentMethodEnabled = vi.fn<CreateRetailSaleWithPlanLimitsDeps["isPaymentMethodEnabled"]>();
const createSale = vi.fn<CreateRetailSaleWithPlanLimitsDeps["createSale"]>();
const deps: CreateRetailSaleWithPlanLimitsDeps = {
  checkModuleAccess,
  checkLimit,
  isPaymentMethodEnabled,
  createSale,
};

describe("createRetailSaleWithPlanLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkModuleAccess.mockResolvedValue(ok(undefined));
    checkLimit.mockResolvedValue(ok(undefined));
    isPaymentMethodEnabled.mockResolvedValue(true);
  });

  it("consulta el módulo vitrina y el cupo de ventas antes de registrar", async () => {
    createSale.mockResolvedValue(ok("sale-1"));

    expect(await createRetailSaleWithPlanLimits(SALON, sale, KEY, deps)).toEqual(ok("sale-1"));
    expect(checkModuleAccess).toHaveBeenCalledWith({ salonId: SALON, moduleKey: "retail" });
    expect(checkLimit).toHaveBeenCalledWith({ salonId: SALON, metricKey: "retail.sales" });
    expect(createSale).toHaveBeenCalledWith(SALON, sale, KEY);
  });

  it("devuelve el rechazo del módulo o del cupo sin registrar", async () => {
    checkModuleAccess.mockResolvedValue(err("Módulo no incluido en tu plan."));
    expect(await createRetailSaleWithPlanLimits(SALON, sale, KEY, deps)).toEqual({
      ok: false,
      error: "Módulo no incluido en tu plan.",
    });

    checkModuleAccess.mockResolvedValue(ok(undefined));
    checkLimit.mockResolvedValue(err("Límite de ventas alcanzado."));
    expect(await createRetailSaleWithPlanLimits(SALON, sale, KEY, deps)).toEqual({
      ok: false,
      error: "Límite de ventas alcanzado.",
    });
    expect(createSale).not.toHaveBeenCalled();
  });

  it("rechaza un método de pago no habilitado por el salón sin registrar", async () => {
    isPaymentMethodEnabled.mockResolvedValue(false);

    expect(await createRetailSaleWithPlanLimits(SALON, sale, KEY, deps)).toEqual({
      ok: false,
      error: "Ese método de pago no está habilitado para este salón.",
    });
    expect(isPaymentMethodEnabled).toHaveBeenCalledWith(SALON, "card");
    expect(createSale).not.toHaveBeenCalled();
  });
});
