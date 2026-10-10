"use server";

import { definePlatformAction } from "@/app/_composition/define-platform-action";
import { parseUuidField } from "@/app/_composition/define-action";
import { ok } from "@/infra/result";
import { assignSalonAddonConfig, cancelSalonExtraConfig, saveSalonManualExtraConfig } from "@/features/billing";
import { assignSalonCommercialPlanConfig, registerSalonPlanPaymentConfig } from "@/features/billing";
import { resolveSalonPlanAlertConfig } from "@/features/billing";
import {
  readAssignPlanInput,
  readGiveAddonInput,
  readManualExtraInput,
  readRegisterPaymentInput,
  type AssignPlanInput,
  type GiveAddonInput,
  type ManualExtraInput,
  type RegisterPaymentInput,
} from "@/features/billing";
import { toPlanActionState, type PlatformPlanActionState } from "../plans/action-state";

const SUBSCRIPTION_PATHS = ["/admin/subscriptions", "/admin/plans", "/admin/salons", "/"];

const assignPlanFlow = definePlatformAction<FormData, AssignPlanInput, string>({
  rateLimit: { scope: "admin:assignPlanAction" },
  parse: (formData) => ok(readAssignPlanInput(formData)),
  run: async (input, session) => {
    const result = await assignSalonCommercialPlanConfig(input, session.userId);
    return result.ok ? ok("Plan asignado.") : result;
  },
  revalidate: () => SUBSCRIPTION_PATHS,
});

export async function assignPlanAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  return toPlanActionState(await assignPlanFlow(formData));
}

const giveAddonFlow = definePlatformAction<FormData, GiveAddonInput, string>({
  rateLimit: { scope: "admin:giveAddonAction" },
  parse: (formData) => ok(readGiveAddonInput(formData)),
  run: async (input, session) => {
    const result = await assignSalonAddonConfig(input, session.userId);
    return result.ok
      ? ok(input.isGift ? "Extra regalado al salon." : "Extra asignado al salon.")
      : result;
  },
  revalidate: () => SUBSCRIPTION_PATHS,
});

export async function giveAddonAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  return toPlanActionState(await giveAddonFlow(formData));
}

const giveManualExtraFlow = definePlatformAction<FormData, ManualExtraInput, string>({
  rateLimit: { scope: "admin:giveManualExtraAction" },
  parse: (formData) => ok(readManualExtraInput(formData)),
  run: async (input, session) => {
    const result = await saveSalonManualExtraConfig(input, session.userId);
    return result.ok ? ok("Cortesia guardada.") : result;
  },
  revalidate: () => SUBSCRIPTION_PATHS,
});

export async function giveManualExtraAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  return toPlanActionState(await giveManualExtraFlow(formData));
}

const registerPaymentFlow = definePlatformAction<FormData, RegisterPaymentInput, string>({
  rateLimit: { scope: "admin:registerPaymentAction" },
  parse: (formData) => ok(readRegisterPaymentInput(formData)),
  run: async (input, session) => {
    const result = await registerSalonPlanPaymentConfig(input, session.userId);
    return result.ok
      ? ok("Pago registrado. La suscripcion quedo activa con su mes de uso.", result.warnings)
      : result;
  },
  revalidate: () => SUBSCRIPTION_PATHS,
});

export async function registerPaymentAction(
  _state: PlatformPlanActionState,
  formData: FormData
): Promise<PlatformPlanActionState> {
  return toPlanActionState(await registerPaymentFlow(formData));
}

interface AlertRaw {
  alertId: string;
  salonId: string;
}

const resolveAlertFlow = definePlatformAction<AlertRaw, AlertRaw, void>({
  rateLimit: { scope: "admin:resolveAlertAction" },
  parse: (raw) => {
    const alertId = parseUuidField(raw.alertId);
    if (!alertId.ok) return alertId;
    const salonId = parseUuidField(raw.salonId);
    return salonId.ok ? ok(raw) : salonId;
  },
  run: async ({ alertId, salonId }, session) => {
    const result = await resolveSalonPlanAlertConfig(alertId, salonId, session.userId);
    return result.ok ? ok(undefined) : result;
  },
  revalidate: () => SUBSCRIPTION_PATHS,
});

/** Las acciones de borrado y resolucion lanzan para que el cliente muestre el error. */
export async function resolveAlertAction(alertId: string, salonId: string): Promise<void> {
  const result = await resolveAlertFlow({ alertId, salonId });
  if (!result.ok) throw new Error(result.error);
}

interface ExtraRaw {
  overrideId: string;
  salonId: string;
}

const cancelExtraFlow = definePlatformAction<ExtraRaw, ExtraRaw, void>({
  rateLimit: { scope: "admin:cancelExtraAction" },
  parse: (raw) => {
    const overrideId = parseUuidField(raw.overrideId);
    if (!overrideId.ok) return overrideId;
    const salonId = parseUuidField(raw.salonId);
    return salonId.ok ? ok(raw) : salonId;
  },
  run: async ({ overrideId, salonId }, session) => {
    const result = await cancelSalonExtraConfig(overrideId, salonId, session.userId);
    return result.ok ? ok(undefined) : result;
  },
  revalidate: () => SUBSCRIPTION_PATHS,
});

export async function cancelExtraAction(overrideId: string, salonId: string): Promise<void> {
  const result = await cancelExtraFlow({ overrideId, salonId });
  if (!result.ok) throw new Error(result.error);
}
