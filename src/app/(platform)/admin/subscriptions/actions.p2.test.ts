import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import {
  assignSalonAddonConfig,
  assignSalonCommercialPlanConfig,
  cancelSalonExtraConfig,
  registerSalonPlanPaymentConfig,
  resolveSalonPlanAlertConfig,
  saveSalonManualExtraConfig,
} from "@/features/billing/use-cases/salon-subscriptions";
import { err, ok } from "@/infra/result";
import { formDataOf } from "@/test/action-fixtures";
import { PLATFORM_PLAN_IDLE_STATE } from "../plans/action-state";
import {
  assignPlanAction,
  cancelExtraAction,
  giveAddonAction,
  giveManualExtraAction,
  registerPaymentAction,
  resolveAlertAction,
} from "./actions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/infra/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/features/billing/use-cases/salon-subscriptions", () => ({
  assignSalonAddonConfig: vi.fn(),
  assignSalonCommercialPlanConfig: vi.fn(),
  cancelSalonExtraConfig: vi.fn(),
  registerSalonPlanPaymentConfig: vi.fn(),
  resolveSalonPlanAlertConfig: vi.fn(),
  saveSalonManualExtraConfig: vi.fn(),
}));

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ad";
const SALON_ID = "00000000-0000-4000-8000-000000000005";
const ALERT_ID = "00000000-0000-4000-8000-0000000000a1";
const OVERRIDE_ID = "00000000-0000-4000-8000-0000000000c1";
const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";
const INVALID_ID = "Identificador inválido.";
const SUBSCRIPTION_PATHS = ["/admin/subscriptions", "/admin/plans", "/admin/salons", "/"];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN_ID);
  rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
});

describe("subscription actions: rate limit", () => {
  it("bloquea cada accion de estado con el mensaje del rate limit", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    const state = await assignPlanAction(PLATFORM_PLAN_IDLE_STATE, new FormData());
    const addonState = await giveAddonAction(PLATFORM_PLAN_IDLE_STATE, new FormData());
    const manualState = await giveManualExtraAction(PLATFORM_PLAN_IDLE_STATE, new FormData());
    const paymentState = await registerPaymentAction(PLATFORM_PLAN_IDLE_STATE, new FormData());

    expect(state).toEqual({ ok: false, message: RATE_LIMIT_MESSAGE });
    expect(addonState).toEqual({ ok: false, message: RATE_LIMIT_MESSAGE });
    expect(manualState).toEqual({ ok: false, message: RATE_LIMIT_MESSAGE });
    expect(paymentState).toEqual({ ok: false, message: RATE_LIMIT_MESSAGE });
    expect(assignSalonCommercialPlanConfig).not.toHaveBeenCalled();
    expect(assignSalonAddonConfig).not.toHaveBeenCalled();
    expect(saveSalonManualExtraConfig).not.toHaveBeenCalled();
    expect(registerSalonPlanPaymentConfig).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", expect.objectContaining({ p_max: 60 }));
  });

  it("lanza el mensaje del rate limit en las acciones que usan excepciones", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });

    await expect(resolveAlertAction(ALERT_ID, SALON_ID)).rejects.toThrow(RATE_LIMIT_MESSAGE);
    await expect(cancelExtraAction(OVERRIDE_ID, SALON_ID)).rejects.toThrow(RATE_LIMIT_MESSAGE);
    expect(resolveSalonPlanAlertConfig).not.toHaveBeenCalled();
    expect(cancelSalonExtraConfig).not.toHaveBeenCalled();
  });
});

describe("assignPlanAction", () => {
  it("asigna el plan con los campos del formulario y revalida", async () => {
    vi.mocked(assignSalonCommercialPlanConfig).mockResolvedValue(ok(undefined) as never);

    const state = await assignPlanAction(
      PLATFORM_PLAN_IDLE_STATE,
      formDataOf({ salonId: SALON_ID, planId: "plan-1", status: "active", endsAt: "2027-01-01", notes: "n" })
    );

    expect(assignSalonCommercialPlanConfig).toHaveBeenCalledWith(
      { salonId: SALON_ID, planId: "plan-1", status: "active", endsAt: "2027-01-01", notes: "n" },
      ADMIN_ID
    );
    expect(state).toEqual({ ok: true, message: "Plan asignado." });
    for (const path of SUBSCRIPTION_PATHS) expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("usa 'trialing' como estado por defecto y devuelve el error del caso de uso", async () => {
    vi.mocked(assignSalonCommercialPlanConfig).mockResolvedValue(err("Plan inactivo.") as never);

    const state = await assignPlanAction(PLATFORM_PLAN_IDLE_STATE, new FormData());

    expect(assignSalonCommercialPlanConfig).toHaveBeenCalledWith(
      expect.objectContaining({ status: "trialing", salonId: "" }),
      ADMIN_ID
    );
    expect(state).toEqual({ ok: false, message: "Plan inactivo." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("giveAddonAction", () => {
  it("un regalo ignora el precio indicado y marca isGift", async () => {
    vi.mocked(assignSalonAddonConfig).mockResolvedValue(ok(undefined) as never);

    const state = await giveAddonAction(
      PLATFORM_PLAN_IDLE_STATE,
      formDataOf({ salonId: SALON_ID, addonId: "a", isGift: "on", priceOverride: "99" })
    );

    expect(assignSalonAddonConfig).toHaveBeenCalledWith(
      expect.objectContaining({ isGift: true, priceOverride: "", quantity: "1" }),
      ADMIN_ID
    );
    expect(state).toEqual({ ok: true, message: "Extra regalado al salon." });
  });

  it("una asignacion de pago conserva el precio indicado", async () => {
    vi.mocked(assignSalonAddonConfig).mockResolvedValue(ok(undefined) as never);

    const state = await giveAddonAction(
      PLATFORM_PLAN_IDLE_STATE,
      formDataOf({ salonId: SALON_ID, addonId: "a", isGift: "false", priceOverride: "49.9", quantity: "2" })
    );

    expect(assignSalonAddonConfig).toHaveBeenCalledWith(
      expect.objectContaining({ isGift: false, priceOverride: "49.9", quantity: "2" }),
      ADMIN_ID
    );
    expect(state).toEqual({ ok: true, message: "Extra asignado al salon." });
  });

  it("devuelve el error del caso de uso sin revalidar", async () => {
    vi.mocked(assignSalonAddonConfig).mockResolvedValue(err("Extra inactivo.") as never);

    const state = await giveAddonAction(PLATFORM_PLAN_IDLE_STATE, new FormData());

    expect(state).toEqual({ ok: false, message: "Extra inactivo." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("giveManualExtraAction", () => {
  it("con targetType 'module' envia moduleKey y habilita el modulo", async () => {
    vi.mocked(saveSalonManualExtraConfig).mockResolvedValue(ok(undefined) as never);

    const state = await giveManualExtraAction(
      PLATFORM_PLAN_IDLE_STATE,
      formDataOf({ salonId: SALON_ID, targetType: "module", moduleKey: "inventory", metricKey: "x", maxDelta: "5", reason: "r" })
    );

    expect(saveSalonManualExtraConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleKey: "inventory",
        metricKey: "",
        moduleEnabled: true,
        maxDelta: "",
        isGift: true,
        reason: "r",
      }),
      ADMIN_ID
    );
    expect(state).toEqual({ ok: true, message: "Cortesia guardada." });
  });

  it("por defecto (metric) envia metricKey y delta sin tocar modulos", async () => {
    vi.mocked(saveSalonManualExtraConfig).mockResolvedValue(ok(undefined) as never);

    await giveManualExtraAction(
      PLATFORM_PLAN_IDLE_STATE,
      formDataOf({ salonId: SALON_ID, moduleKey: "inventory", metricKey: "appointments", maxDelta: "20" })
    );

    expect(saveSalonManualExtraConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleKey: "",
        metricKey: "appointments",
        moduleEnabled: null,
        maxDelta: "20",
        maxOverride: "",
      }),
      ADMIN_ID
    );
  });

  it("devuelve el error del caso de uso sin revalidar", async () => {
    vi.mocked(saveSalonManualExtraConfig).mockResolvedValue(err("Motivo obligatorio.") as never);

    const state = await giveManualExtraAction(PLATFORM_PLAN_IDLE_STATE, new FormData());

    expect(state).toEqual({ ok: false, message: "Motivo obligatorio." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("registerPaymentAction", () => {
  it("registra el pago y deja paidAt indefinido si llega vacio", async () => {
    vi.mocked(registerSalonPlanPaymentConfig).mockResolvedValue(ok(undefined) as never);

    const state = await registerPaymentAction(
      PLATFORM_PLAN_IDLE_STATE,
      formDataOf({ salonId: SALON_ID, amount: "120", paidAt: "", notes: "transferencia" })
    );

    expect(registerSalonPlanPaymentConfig).toHaveBeenCalledWith(
      { salonId: SALON_ID, amount: "120", paidAt: undefined, notes: "transferencia" },
      ADMIN_ID
    );
    expect(state.ok).toBe(true);
    expect(state.message).toBe("Pago registrado. La suscripcion quedo activa con su mes de uso.");
    for (const path of SUBSCRIPTION_PATHS) expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("pasa la fecha de pago cuando se indica y devuelve el error si falla", async () => {
    vi.mocked(registerSalonPlanPaymentConfig).mockResolvedValueOnce(ok(undefined) as never);
    await registerPaymentAction(PLATFORM_PLAN_IDLE_STATE, formDataOf({ paidAt: "2026-05-01" }));
    expect(registerSalonPlanPaymentConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({ paidAt: "2026-05-01", amount: "0" }),
      ADMIN_ID
    );

    vi.mocked(registerSalonPlanPaymentConfig).mockResolvedValueOnce(err("Monto inválido.") as never);
    const state = await registerPaymentAction(PLATFORM_PLAN_IDLE_STATE, new FormData());
    expect(state).toEqual({ ok: false, message: "Monto inválido." });
  });

  it("devuelve los avisos del pago guardado cuando un efecto posterior falló", async () => {
    vi.mocked(registerSalonPlanPaymentConfig).mockResolvedValueOnce(
      ok(undefined, ["La auditoria no se registro."]) as never
    );
    const state = await registerPaymentAction(PLATFORM_PLAN_IDLE_STATE, formDataOf({ amount: "30" }));
    expect(state).toMatchObject({
      ok: true,
      message: "Pago registrado. La suscripcion quedo activa con su mes de uso.",
      warnings: ["La auditoria no se registro."],
    });
  });
});

describe("resolveAlertAction", () => {
  it("rechaza un id de alerta invalido", async () => {
    await expect(resolveAlertAction("alerta", SALON_ID)).rejects.toThrow(INVALID_ID);
    expect(resolveSalonPlanAlertConfig).not.toHaveBeenCalled();
  });

  it("rechaza un salonId invalido", async () => {
    await expect(resolveAlertAction(ALERT_ID, "salon")).rejects.toThrow(INVALID_ID);
    expect(resolveSalonPlanAlertConfig).not.toHaveBeenCalled();
  });

  it("resuelve la alerta y revalida; lanza el error del caso de uso si falla", async () => {
    vi.mocked(resolveSalonPlanAlertConfig).mockResolvedValueOnce(ok(undefined) as never);

    await expect(resolveAlertAction(ALERT_ID, SALON_ID)).resolves.toBeUndefined();
    expect(resolveSalonPlanAlertConfig).toHaveBeenCalledWith(ALERT_ID, SALON_ID, ADMIN_ID);
    for (const path of SUBSCRIPTION_PATHS) expect(revalidatePath).toHaveBeenCalledWith(path);

    vi.mocked(resolveSalonPlanAlertConfig).mockResolvedValueOnce(err("Alerta ya resuelta.") as never);
    await expect(resolveAlertAction(ALERT_ID, SALON_ID)).rejects.toThrow("Alerta ya resuelta.");
  });
});

describe("cancelExtraAction", () => {
  it("rechaza un id de extra o de salon invalido", async () => {
    await expect(cancelExtraAction("extra", SALON_ID)).rejects.toThrow(INVALID_ID);
    await expect(cancelExtraAction(OVERRIDE_ID, "salon")).rejects.toThrow(INVALID_ID);
    expect(cancelSalonExtraConfig).not.toHaveBeenCalled();
  });

  it("cancela el extra y revalida; lanza el error del caso de uso si falla", async () => {
    vi.mocked(cancelSalonExtraConfig).mockResolvedValueOnce(ok(undefined) as never);

    await expect(cancelExtraAction(OVERRIDE_ID, SALON_ID)).resolves.toBeUndefined();
    expect(cancelSalonExtraConfig).toHaveBeenCalledWith(OVERRIDE_ID, SALON_ID, ADMIN_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/subscriptions");

    vi.mocked(cancelSalonExtraConfig).mockResolvedValueOnce(err("Extra ya cancelado.") as never);
    await expect(cancelExtraAction(OVERRIDE_ID, SALON_ID)).rejects.toThrow("Extra ya cancelado.");
  });
});
