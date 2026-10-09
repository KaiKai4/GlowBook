import { describe, expect, it } from "vitest";
import {
  readAssignPlanInput,
  readGiveAddonInput,
  readManualExtraInput,
  readRegisterPaymentInput,
} from "./salon-subscriptions-form";

function fields(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

describe("readAssignPlanInput", () => {
  it("usa 'trialing' como estado por defecto y deja los textos vacios", () => {
    expect(readAssignPlanInput(new FormData())).toEqual({
      salonId: "",
      planId: "",
      status: "trialing",
      endsAt: "",
      notes: "",
    });
  });

  it("conserva el estado indicado", () => {
    expect(readAssignPlanInput(fields({ status: "active" })).status).toBe("active");
  });
});

describe("readGiveAddonInput", () => {
  it("un regalo ignora el precio indicado y la cantidad por defecto es 1", () => {
    expect(readGiveAddonInput(fields({ isGift: "on", priceOverride: "99" }))).toMatchObject({
      isGift: true,
      priceOverride: "",
      quantity: "1",
    });
  });

  it("una asignacion de pago conserva el precio indicado", () => {
    expect(
      readGiveAddonInput(fields({ isGift: "false", priceOverride: "49.9", quantity: "2" }))
    ).toMatchObject({ isGift: false, priceOverride: "49.9", quantity: "2" });
  });
});

describe("readManualExtraInput", () => {
  it("con targetType 'module' envia el modulo, habilitado, y vacia la metrica", () => {
    expect(
      readManualExtraInput(
        fields({ salonId: "s", targetType: "module", moduleKey: "inventory", metricKey: "x", maxDelta: "5", reason: "r" })
      )
    ).toEqual({
      salonId: "s",
      moduleKey: "inventory",
      metricKey: "",
      moduleEnabled: true,
      maxDelta: "",
      maxOverride: "",
      isGift: true,
      reason: "r",
      startsAt: "",
      endsAt: "",
    });
  });

  it("por defecto (metric) envia la metrica y el delta sin tocar modulos", () => {
    expect(
      readManualExtraInput(fields({ moduleKey: "inventory", metricKey: "appointments", maxDelta: "20" }))
    ).toMatchObject({
      moduleKey: "",
      metricKey: "appointments",
      moduleEnabled: null,
      maxDelta: "20",
    });
  });

  it("un tipo desconocido no envia ni modulo ni metrica ni delta", () => {
    expect(
      readManualExtraInput(fields({ targetType: "otro", moduleKey: "m", metricKey: "x", maxDelta: "1" }))
    ).toMatchObject({ moduleKey: "", metricKey: "", moduleEnabled: null, maxDelta: "" });
  });
});

describe("readRegisterPaymentInput", () => {
  it("un importe vacio por defecto es 0 y una fecha vacia queda indefinida", () => {
    expect(readRegisterPaymentInput(fields({ salonId: "s", paidAt: "", notes: "n" }))).toEqual({
      salonId: "s",
      amount: "0",
      paidAt: undefined,
      notes: "n",
    });
  });

  it("pasa la fecha de pago cuando se indica", () => {
    expect(readRegisterPaymentInput(fields({ paidAt: "2026-05-01", amount: "120" }))).toMatchObject({
      paidAt: "2026-05-01",
      amount: "120",
    });
  });
});
