import { toPublicErrorMessage } from "@/lib/errors";
import "server-only";
import { cache } from "react";
import { z } from "@/lib/validation/zod";
import { err, ok, type Result } from "@/lib/result";
import { readEffectivePlanOrNull } from "./effective-plan-fallback";
import { getDisabledSalonFeatures } from "@/lib/auth/permissions";
import type { ProfileWithRole } from "@/types/app.types";
import type { SalonFeatureKey } from "@/features/salon/domain/salon-features";
import { SALON_FEATURES } from "@/features/salon/domain/salon-features";
import {
  calculateLimitState,
  checkLimitAction,
  type CommercialLimitMetric,
  type CommercialPlan,
  type EffectivePlanLimit,
  type EffectiveSalonPlan,
  type PlanEnforcementMode,
  type SalonPlanAssignmentStatus,
  type SalonPlanOverride,
  type SalonPlanUsageByMetric,
} from "../domain/commercial-plan";
import {
  buildSalonExtras,
  extraMonthlyPrice,
  resolveOverrideMax,
  resolveOverrideMode,
  resolveOverrideThreshold,
  type CommercialAddon,
} from "../domain/salon-extras";
import {
  deriveAssignmentSchedule,
  derivePaymentPeriod,
  todayIso,
} from "../domain/assignment-schedule";
import { findCommercialAddonById, findCommercialAddons } from "../data/commercial-addons.repo";
import {
  activatePaidPeriod,
  assignSalonPlan,
  findAssignmentForPayment,
  findAssignmentStartsAt,
  findEffectivePlanRows,
  findOpenSalonAlerts,
  findSalonPayments,
  findSubscriptionRows,
  hasOpenPlanAlert,
  recordPlanAlert,
  recordSalonPlanPayment,
  resolvePlanAlert,
  saveSalonPlanOverride,
  updateSalonPlanOverrideStatus,
} from "../data/salon-subscriptions.repo";
import { findPlanCatalog, findPlanWithChildren } from "../data/commercial-plans.repo";
import { commercialPlanAudit, dateOrNull } from "./billing-shared";
import { publishAuditEvent } from "@/features/audit";
import { firstIssueMessage } from "@/lib/validation/first-issue";

const AssignmentSchema = z.object({
  salonId: z.string().uuid("Selecciona un salon."),
  planId: z.string().uuid("Selecciona un plan."),
  status: z.enum(["trialing", "active", "past_due", "paused", "canceled"]).default("trialing"),
  // Inicio y fin del trial se derivan del plan; no se piden al usuario.
  // Solo fin (suspension programada) es opcional y manual.
  endsAt: z.string().trim().optional(),
  notes: z.string().trim().max(400).default(""),
});

const AddonExtraSchema = z.object({
  salonId: z.string().uuid("Selecciona un salon."),
  addonId: z.string().uuid("Selecciona un extra del catalogo."),
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
  salonId: z.string().uuid("Selecciona un salon."),
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

// cache(): el plan efectivo se consulta desde el perfil, el shell y las
// paginas dentro del mismo request; una sola lectura alimenta a todos.
/** Estados en los que el plan de la asignación está vigente (se factura y da módulos). */
function isPlanAssignmentActive(status: SalonPlanAssignmentStatus | null | undefined): boolean {
  return status === "trialing" || status === "active" || status === "past_due";
}

export const getEffectiveSalonPlan = cache(async (salonId: string): Promise<EffectiveSalonPlan> => {
  const rows = await findEffectivePlanRows(salonId);
  const plan = isPlanAssignmentActive(rows.assignment?.status) ? rows.plan : null;
  const enabled = resolveEnabledModules(plan, rows.overrides);

  const disabledModules = SALON_FEATURES
    .map((feature) => feature.key)
    .filter((key) => !enabled.has(key));

  return {
    salonId,
    plan,
    assignmentStatus: rows.assignment?.status ?? null,
    currentPeriodEnd: rows.assignment?.current_period_end ?? null,
    trialEndsAt: rows.assignment?.trial_ends_at ?? null,
    enabledModules: Array.from(enabled),
    disabledModules,
    limits: buildEffectiveLimits(plan, rows.metrics, rows.overrides, rows.usage, enabled),
    usage: rows.usage,
  };
});

export async function checkPlanLimit(input: {
  salonId: string;
  metricKey: string;
  requestedAmount?: number;
}): Promise<Result<void>> {
  const plan = await getEffectiveSalonPlan(input.salonId);
  const limit = plan.limits.find((item) => item.metric.key === input.metricKey);
  if (!limit) return ok(undefined);

  const check = checkLimitAction({
    metricKey: input.metricKey,
    metricName: limit.metric.name,
    used: limit.used,
    requested: input.requestedAmount ?? 1,
    maxValue: limit.maxValue,
    enforcementMode: limit.enforcementMode,
  });

  if (!check.allowed) {
    await recordPlanAlertOnce({
      salonId: input.salonId,
      planId: plan.plan?.id ?? null,
      metricKey: input.metricKey,
      moduleKey: limit.metric.moduleKey,
      severity: "danger",
      message: check.message,
    });
    return err(check.message);
  }

  if (limit.warningLevel === "near_limit" || limit.warningLevel === "over_limit") {
    await recordPlanAlertOnce({
      salonId: input.salonId,
      planId: plan.plan?.id ?? null,
      metricKey: input.metricKey,
      moduleKey: limit.metric.moduleKey,
      severity: limit.warningLevel === "over_limit" ? "danger" : "warning",
      message: limit.message,
    });
  }

  return ok(undefined);
}

// Una alerta abierta por salon y límite: las acciones repetidas cerca del
// límite no deben inundar el panel de plataforma.
async function recordPlanAlertOnce(values: Parameters<typeof recordPlanAlert>[0]) {
  if (values.metricKey && (await hasOpenPlanAlert(values.salonId, values.metricKey))) return;
  await recordPlanAlert(values);
}

export async function resolveSalonPlanAlertConfig(
  alertId: string,
  salonId: string,
  actorUserId?: string | null
): Promise<Result<void>> {
  try {
    await resolvePlanAlert(alertId);
    const warnings = await publishAuditEvent("billing.plan_alert_resolved", { ...commercialPlanAudit(actorUserId, salonId), action: "commercial_plan_alert_resolved" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo resolver la alerta."));
  }
}

export async function checkPlanModuleAccess(input: {
  salonId: string;
  moduleKey: SalonFeatureKey;
}): Promise<Result<void>> {
  const plan = await getEffectiveSalonPlan(input.salonId);
  if (!plan.plan) return ok(undefined);
  if (plan.enabledModules.includes(input.moduleKey)) return ok(undefined);

  const label = SALON_FEATURES.find((feature) => feature.key === input.moduleKey)?.label ?? "Modulo";
  return err(`${label} no esta incluido en el plan de este salon.`);
}

export async function getEffectiveDisabledSalonFeatures(
  profile: ProfileWithRole
): Promise<SalonFeatureKey[]> {
  const legacyDisabledFeatures = getDisabledSalonFeatures(profile);
  const effectivePlan = await readEffectivePlanOrNull(profile.salon_id, "disabled-features", getEffectiveSalonPlan);
  if (effectivePlan?.plan) return effectivePlan.disabledModules;
  return legacyDisabledFeatures;
}

export async function isEffectiveSalonModuleEnabled(
  profile: ProfileWithRole,
  moduleKey: SalonFeatureKey
): Promise<boolean> {
  const effectivePlan = await readEffectivePlanOrNull(profile.salon_id, "module-enabled", getEffectiveSalonPlan);
  if (effectivePlan?.plan) return effectivePlan.enabledModules.includes(moduleKey);
  return !getDisabledSalonFeatures(profile).includes(moduleKey);
}

export async function assignSalonCommercialPlanConfig(
  input: z.input<typeof AssignmentSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = AssignmentSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  try {
    const [plan, existingStartsAt] = await Promise.all([
      findPlanWithChildren(parsed.data.planId),
      findAssignmentStartsAt(parsed.data.salonId),
    ]);
    if (!plan) return err("El plan seleccionado no existe.");

    const schedule = deriveAssignmentSchedule({
      status: parsed.data.status,
      trialDays: plan.trialDays,
      today: todayIso(),
      existingStartsAt,
    });

    await assignSalonPlan({
      salonId: parsed.data.salonId,
      planId: parsed.data.planId,
      status: parsed.data.status,
      startsAt: schedule.startsAt,
      endsAt: dateOrNull(parsed.data.endsAt),
      trialEndsAt: schedule.trialEndsAt,
      notes: parsed.data.notes,
    });
    const warnings = await publishAuditEvent("billing.plan_assigned", { ...commercialPlanAudit(actorUserId, parsed.data.salonId), action: "commercial_plan_assigned" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo asignar el plan."));
  }
}

/**
 * Asigna el plan elegido en la invitacion apenas el salon se crea.
 * Asi el salon nace con sus modulos y límites correctos y nunca ve
 * funcionalidades que su plan no incluye.
 */
export async function autoAssignPlanOnAcceptance(input: {
  salonId: string;
  planId: string;
  acceptedByUserId: string;
}): Promise<Result<void>> {
  try {
    const plan = await findPlanWithChildren(input.planId);
    if (!plan) return err("El plan de la invitacion ya no existe.");

    const status = plan.trialDays > 0 ? "trialing" : "active";
    const schedule = deriveAssignmentSchedule({
      status,
      trialDays: plan.trialDays,
      today: todayIso(),
      existingStartsAt: null,
    });

    await assignSalonPlan({
      salonId: input.salonId,
      planId: input.planId,
      status,
      startsAt: schedule.startsAt,
      endsAt: null,
      trialEndsAt: schedule.trialEndsAt,
      notes: "Asignado automaticamente al aceptar la invitacion.",
    });
    const warnings = await publishAuditEvent("billing.plan_assigned", { ...commercialPlanAudit(input.acceptedByUserId, input.salonId), action: "commercial_plan_assigned" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo asignar el plan de la invitacion."));
  }
}

const PaymentSchema = z.object({
  salonId: z.string().uuid("Selecciona un salon."),
  amount: z.coerce.number().min(0, "El monto no puede ser negativo."),
  paidAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de pago inválida.")
    .optional(),
  notes: z.string().trim().max(400).default(""),
});

/**
 * Registra que el salon pago su mensualidad: guarda el pago en el historial,
 * activa la suscripcion y fija el mes de uso (periodo) que cubre ese pago.
 */
export async function registerSalonPlanPaymentConfig(
  input: z.input<typeof PaymentSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = PaymentSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  try {
    const assignment = await findAssignmentForPayment(parsed.data.salonId);
    if (!assignment) return err("Este salon no tiene plan asignado. Asignale un plan primero.");

    const plan = await findPlanWithChildren(assignment.plan_id);
    const paidAt = parsed.data.paidAt || todayIso();
    const period = derivePaymentPeriod({
      paidAt,
      currentPeriodEnd: assignment.current_period_end,
    });

    await recordSalonPlanPayment({
      salonId: parsed.data.salonId,
      planId: assignment.plan_id,
      amount: parsed.data.amount,
      currency: plan?.currency ?? "USD",
      paidAt,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      notes: parsed.data.notes,
    });
    await activatePaidPeriod({
      salonId: parsed.data.salonId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    });
    const warnings = await publishAuditEvent("billing.payment_registered", { ...commercialPlanAudit(actorUserId, parsed.data.salonId), action: "commercial_plan_payment_recorded" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo registrar el pago."));
  }
}

export async function assignSalonAddonConfig(
  input: z.input<typeof AddonExtraSchema>,
  actorUserId?: string | null
): Promise<Result<void>> {
  const parsed = AddonExtraSchema.safeParse(input);
  if (!parsed.success) return err(firstIssueMessage(parsed.error));

  try {
    const addon = await findCommercialAddonById(parsed.data.addonId);
    if (!addon) return err("El extra del catalogo no existe.");
    if (addon.status !== "active") return err("Este extra no esta activo en el catalogo.");

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
    return err("Selecciona un modulo o un límite para el extra.");
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
    await updateSalonPlanOverrideStatus(overrideId, "canceled");
    const warnings = await publishAuditEvent("billing.plan_extra_canceled", { ...commercialPlanAudit(actorUserId, salonId), action: "commercial_plan_extra_canceled" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo cancelar el extra."));
  }
}

export interface SalonSubscriptionRow {
  salonId: string;
  salonName: string;
  salonIsActive: boolean;
  planId: string | null;
  planName: string | null;
  planPrice: number;
  currency: string;
  status: SalonPlanAssignmentStatus | null;
  trialEndsAt: string | null;
  extrasCount: number;
  extrasPrice: number;
  monthlyTotal: number;
  openAlertCount: number;
}

export interface SubscriptionsPageData {
  rows: SalonSubscriptionRow[];
  plans: CommercialPlan[];
  addons: CommercialAddon[];
  metrics: CommercialLimitMetric[];
  modules: { key: SalonFeatureKey; name: string }[];
  totals: {
    mrr: number;
    salonsWithPlan: number;
    trialing: number;
    openAlerts: number;
  };
}

export async function getSubscriptionsPage(
  salons: Array<{ id: string; name: string; is_active: boolean }>
): Promise<SubscriptionsPageData> {
  const [catalog, addons, subscription] = await Promise.all([
    findPlanCatalog(),
    findCommercialAddons(),
    findSubscriptionRows(),
  ]);

  const planById = new Map(catalog.plans.map((plan) => [plan.id, plan]));
  const assignmentBySalon = new Map(subscription.assignments.map((row) => [row.salon_id, row]));
  const extras = buildSalonExtras(subscription.overrides, addons);

  const rows = salons.map((salon) => {
    const assignment = assignmentBySalon.get(salon.id);
    const plan = assignment ? planById.get(assignment.plan_id) ?? null : null;
    const billable = assignment?.status === "active" || assignment?.status === "trialing" || assignment?.status === "past_due";
    const salonExtras = extras.filter(
      (extra) => extra.override.salonId === salon.id && extra.override.status === "active"
    );
    const extrasPrice = round2(salonExtras.reduce((total, extra) => total + extra.monthlyPrice, 0));
    const planPrice = billable && plan ? plan.monthlyPrice : 0;
    const openAlertCount = subscription.alerts.filter(
      (alert) => alert.salon_id === salon.id && alert.status === "open"
    ).length;

    return {
      salonId: salon.id,
      salonName: salon.name,
      salonIsActive: salon.is_active,
      planId: plan?.id ?? null,
      planName: plan?.name ?? null,
      planPrice,
      currency: plan?.currency ?? "USD",
      status: assignment?.status ?? null,
      trialEndsAt: assignment?.trial_ends_at ?? null,
      extrasCount: salonExtras.length,
      extrasPrice,
      monthlyTotal: round2(planPrice + extrasPrice),
      openAlertCount,
    } satisfies SalonSubscriptionRow;
  });

  const mrr = round2(
    rows
      .filter((row) => row.status === "active")
      .reduce((total, row) => total + row.monthlyTotal, 0)
  );

  return {
    rows,
    plans: catalog.plans.filter((plan) => plan.status === "active"),
    addons: addons.filter((addon) => addon.status === "active"),
    metrics: catalog.metrics.filter((metric) => metric.isActive && !metric.isArchived),
    modules: catalog.modules
      .filter((module) => module.isActive && !module.isArchived)
      .map((module) => ({ key: module.key, name: module.name })),
    totals: {
      mrr,
      salonsWithPlan: rows.filter((row) => row.planId !== null).length,
      trialing: rows.filter((row) => row.status === "trialing").length,
      openAlerts: rows.reduce((total, row) => total + row.openAlertCount, 0),
    },
  };
}

export interface SalonExtraView {
  id: string;
  name: string;
  detail: string;
  quantity: number;
  isGift: boolean;
  monthlyPrice: number;
  endsAt: string | null;
  reason: string;
}

interface SalonPaymentView {
  id: string;
  amount: number;
  currency: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  notes: string;
}

interface SalonAlertView {
  id: string;
  severity: "info" | "warning" | "danger";
  message: string;
  createdAt: string;
}

export interface SalonSubscriptionDetail {
  salonId: string;
  assignment: {
    planId: string;
    status: SalonPlanAssignmentStatus;
    startsAt: string | null;
    endsAt: string | null;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    notes: string;
  } | null;
  plan: CommercialPlan | null;
  enabledModules: SalonFeatureKey[];
  limits: EffectivePlanLimit[];
  extras: SalonExtraView[];
  payments: SalonPaymentView[];
  openAlerts: SalonAlertView[];
  planPrice: number;
  extrasPrice: number;
  monthlyTotal: number;
}

export async function getSalonSubscriptionDetail(salonId: string): Promise<SalonSubscriptionDetail> {
  const [rows, addons, modules, payments, openAlerts] = await Promise.all([
    findEffectivePlanRows(salonId),
    findCommercialAddons(),
    findPlanCatalog().then((catalog) => catalog.modules),
    findSalonPayments(salonId),
    findOpenSalonAlerts(salonId),
  ]);

  // Mismo criterio que getEffectiveSalonPlan: un plan pausado/cancelado no da módulos ni límites.
  const plan = isPlanAssignmentActive(rows.assignment?.status) ? rows.plan : null;
  const enabled = resolveEnabledModules(plan, rows.overrides);
  const extras = buildSalonExtras(rows.overrides, addons);
  const moduleByKey = new Map(modules.map((module) => [module.key, module.name]));
  const metricByKey = new Map(rows.metrics.map((metric) => [metric.key, metric]));

  const extrasViews = extras.map(({ override, addon }) => ({
    id: override.id,
    name: addon?.name ?? manualExtraName(override, moduleByKey, metricByKey),
    detail: extraDetail(override, addon, metricByKey),
    quantity: override.quantity,
    isGift: override.isGift,
    monthlyPrice: extraMonthlyPrice(override, addon),
    endsAt: override.endsAt,
    reason: override.reason,
  }));

  const planPrice = plan ? plan.monthlyPrice : 0;
  const extrasPrice = round2(extrasViews.reduce((total, extra) => total + extra.monthlyPrice, 0));

  return {
    salonId,
    assignment: rows.assignment
      ? {
          planId: rows.assignment.plan_id,
          status: rows.assignment.status,
          startsAt: rows.assignment.starts_at,
          endsAt: rows.assignment.ends_at,
          trialEndsAt: rows.assignment.trial_ends_at,
          currentPeriodStart: rows.assignment.current_period_start,
          currentPeriodEnd: rows.assignment.current_period_end,
          notes: rows.assignment.notes,
        }
      : null,
    plan,
    enabledModules: Array.from(enabled),
    limits: buildEffectiveLimits(plan, rows.metrics, rows.overrides, rows.usage, enabled),
    extras: extrasViews,
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidAt: payment.paid_at,
      periodStart: payment.period_start,
      periodEnd: payment.period_end,
      notes: payment.notes,
    })),
    openAlerts: openAlerts.map((alert) => ({
      id: alert.id,
      severity: alert.severity,
      message: alert.message,
      createdAt: alert.created_at,
    })),
    planPrice,
    extrasPrice,
    monthlyTotal: round2(planPrice + extrasPrice),
  };
}

function resolveEnabledModules(
  plan: CommercialPlan | null,
  overrides: SalonPlanOverride[]
): Set<SalonFeatureKey> {
  const enabled = new Set<SalonFeatureKey>();
  if (plan) {
    for (const planModule of plan.modules) {
      if (planModule.enabled) enabled.add(planModule.moduleKey);
    }
  }
  for (const override of overrides) {
    if (!override.moduleKey || override.moduleEnabled === null) continue;
    if (override.moduleEnabled) enabled.add(override.moduleKey);
    else enabled.delete(override.moduleKey);
  }
  return enabled;
}

function buildEffectiveLimits(
  plan: CommercialPlan | null,
  metrics: CommercialLimitMetric[],
  overrides: SalonPlanOverride[],
  usage: SalonPlanUsageByMetric,
  enabledModules: Set<SalonFeatureKey>
): EffectivePlanLimit[] {
  if (!plan) return [];
  const limitByMetric = new Map(plan.limits.map((limit) => [limit.metricKey, limit]));

  // Solo los límites de modulos que el salon realmente tiene: un límite de un
  // modulo apagado no controla nada y solo hace ruido.
  return metrics.filter((metric) => enabledModules.has(metric.moduleKey)).map((metric) => {
    const base = limitByMetric.get(metric.key);
    const metricOverrides = overrides.filter((override) => override.metricKey === metric.key);
    const maxValue = resolveOverrideMax(base?.maxValue ?? null, metricOverrides);
    const enforcementMode = resolveOverrideMode(
      (base?.enforcementMode ?? "warn") as PlanEnforcementMode,
      metricOverrides
    );
    const warningThreshold = resolveOverrideThreshold(base?.warningThreshold ?? 80, metricOverrides);
    const countScope = base?.countScope ?? metric.defaultCountScope;

    return calculateLimitState({
      metric,
      maxValue,
      enforcementMode,
      warningThreshold,
      countScope,
      used: usage[metric.key] ?? 0,
    });
  });
}

function manualExtraName(
  override: SalonPlanOverride,
  moduleByKey: Map<string, string>,
  metricByKey: Map<string, CommercialLimitMetric>
): string {
  if (override.moduleKey) return moduleByKey.get(override.moduleKey) ?? override.moduleKey;
  if (override.metricKey) return metricByKey.get(override.metricKey)?.name ?? override.metricKey;
  return "Extra personalizado";
}

function extraDetail(
  override: SalonPlanOverride,
  addon: CommercialAddon | null,
  metricByKey: Map<string, CommercialLimitMetric>
): string {
  if (override.moduleKey && override.moduleEnabled !== null) {
    return override.moduleEnabled ? "Modulo activado" : "Modulo desactivado";
  }
  const metric = override.metricKey ? metricByKey.get(override.metricKey) : null;
  const unit = metric?.unit ?? "";
  const delta = override.maxDelta ?? addon?.limitDelta ?? null;
  if (override.maxOverride !== null) return `Límite fijado en ${override.maxOverride} ${unit}`.trim();
  if (delta !== null) return `+${delta * override.quantity} ${unit}`.trim();
  return "Ajuste de límite";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
