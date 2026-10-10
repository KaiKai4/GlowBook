import "server-only";
import { toPublicErrorMessage } from "@/infra/errors";
import { z } from "@/infra/validation/zod";
import { err, ok, type Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";
import { findCommercialAddonById } from "../data/commercial-addons.repo";
import {
  saveSalonPlanOverride,
  updateSalonPlanOverrideStatus,
} from "../data/salon-subscriptions.repo";
import { commercialPlanAudit, dateOrNull } from "./billing-shared";
import { publishAuditEvent } from "@/features/audit";

const AddonExtraSchema = z.object({
  salonId: z.string().uuid("Selecciona un salón."),
  addonId: z.string().uuid("Selecciona un extra del catálogo."),
  quantity: z.coerce.number().int().min(1, "La cantidad minima es 1.").max(999).default(1),
  isGift: z.boolean().default(false),
  // "" se evalúa antes que coerce: un campo vacío es "sin precio especial"
  // (null => precio de catálogo), nunca 0 (extra gratis).
  priceOverride: z
    .union([z.literal("").transform(() => null), z.coerce.number().min(0)])
    .nullable()
    .default(null),
  reason: z.string().trim().max(400).default(""),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
});

const ManualExtraSchema = z.object({
  salonId: z.string().uuid("Selecciona un salón."),
  moduleKey: z.string().trim().optional(),
  metricKey: z.string().trim().optional(),
  moduleEnabled: z.boolean().nullable().default(null),
  // "" evaluado antes que coerce: vacío = sin tope (null), nunca 0.
  maxDelta: z
    .union([z.literal("").transform(() => null), z.coerce.number().int().min(0)])
    .nullable()
    .default(null),
  maxOverride: z
    .union([z.literal("").transform(() => null), z.coerce.number().int().min(0)])
    .nullable()
    .default(null),
  isGift: z.boolean().default(true),
  reason: z.string().trim().max(400).default(""),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
});

export async function assignSalonAddonConfig(
  input: z.input<typeof AddonExtraSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = AddonExtraSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));

  try {
    const addon = await findCommercialAddonById(parsed.data.addonId);
    if (!addon) return err("El extra del catálogo no existe.");
    if (addon.status !== "active") return err("Este extra no está activo en el catálogo.");

    await saveSalonPlanOverride({
      salonId: parsed.data.salonId,
      moduleKey: addon.moduleKey,
      metricKey: addon.metricKey,
      moduleEnabled: addon.kind === "module" ? true : null,
      maxDelta: addon.kind === "limit_boost" ? addon.limitDelta : null,
      maxOverride: null,
      enforcementMode: null,
      warningThreshold: null,
      reason: parsed.data.reason,
      startsAt: dateOrNull(parsed.data.startsAt),
      endsAt: dateOrNull(parsed.data.endsAt),
      status: "active",
      addonId: addon.id,
      quantity: addon.kind === "limit_boost" ? parsed.data.quantity : 1,
      isGift: parsed.data.isGift,
      priceOverride: parsed.data.priceOverride,
    });
    const warnings = await publishAuditEvent("billing.plan_extra_assigned", { ...commercialPlanAudit(actorUserId, parsed.data.salonId), action: "commercial_plan_extra_assigned" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo asignar el extra."));
  }
}

export async function saveSalonManualExtraConfig(
  input: z.input<typeof ManualExtraSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = ManualExtraSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  if (!parsed.data.moduleKey && !parsed.data.metricKey) {
    return err("Selecciona un módulo o un límite para el extra.");
  }

  try {
    await saveSalonPlanOverride({
      salonId: parsed.data.salonId,
      moduleKey: parsed.data.moduleKey || null,
      metricKey: parsed.data.metricKey || null,
      moduleEnabled: parsed.data.moduleKey ? parsed.data.moduleEnabled ?? true : null,
      maxDelta: parsed.data.maxDelta,
      maxOverride: parsed.data.maxOverride,
      enforcementMode: null,
      warningThreshold: null,
      reason: parsed.data.reason,
      startsAt: dateOrNull(parsed.data.startsAt),
      endsAt: dateOrNull(parsed.data.endsAt),
      status: "active",
      addonId: null,
      quantity: 1,
      isGift: parsed.data.isGift,
      priceOverride: null,
    });
    const warnings = await publishAuditEvent("billing.plan_override_saved", { ...commercialPlanAudit(actorUserId, parsed.data.salonId), action: "commercial_plan_override_saved" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo guardar el extra."));
  }
}

export async function cancelSalonExtraConfig(
  overrideId: string,
  salonId: string,
  actorUserId?: string | null
): Promise<Result<void>> {
  try {
    await updateSalonPlanOverrideStatus(salonId, overrideId, "canceled");
    const warnings = await publishAuditEvent("billing.plan_extra_canceled", { ...commercialPlanAudit(actorUserId, salonId), action: "commercial_plan_extra_canceled" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo cancelar el extra."));
  }
}
